import { runInNewContext } from "vm";
import { TransactionExtended, TransactionStripped } from "../mempool.interfaces";
import { Common } from "./common";

interface RbfTransaction extends TransactionStripped {
  rbf?: boolean;
  mined?: boolean;
}

interface RbfTree {
  tx: RbfTransaction;
  time: number;
  interval?: number;
  mined?: boolean;
  fullRbf: boolean;
  replaces: RbfTree[];
}

class RbfCache {
  private replacedBy: Map<string, string> = new Map();
  private replaces: Map<string, string[]> = new Map();
  private rbfTrees: Map<string, RbfTree> = new Map(); // sequences of consecutive replacements
  private dirtyTrees: Set<string> = new Set();
  private treeMap: Map<string, string> = new Map(); // map of txids to sequence ids
  private txs: Map<string, TransactionExtended> = new Map();
  private expiring: Map<string, Date> = new Map();

  constructor() {
    setInterval(this.cleanup.bind(this), 1000 * 60 * 60);
  }

  public add(replaced: TransactionExtended[], newTxExtended: TransactionExtended): void {
    if (!newTxExtended || !replaced?.length) {
      return;
    }

    const newTx = Common.stripTransaction(newTxExtended) as RbfTransaction;
    const newTime = newTxExtended.firstSeen || Date.now();
    newTx.rbf = newTxExtended.vin.some((v) => v.sequence < 0xfffffffe);
    this.txs.set(newTx.txid, newTxExtended);

    // maintain rbf trees
    let fullRbf = false;
    const replacedTrees: RbfTree[] = [];
    for (const replacedTxExtended of replaced) {
      const replacedTx = Common.stripTransaction(replacedTxExtended) as RbfTransaction;
      replacedTx.rbf = replacedTxExtended.vin.some((v) => v.sequence < 0xfffffffe);
      this.replacedBy.set(replacedTx.txid, newTx.txid);
      if (this.treeMap.has(replacedTx.txid)) {
        const treeId = this.treeMap.get(replacedTx.txid);
        if (treeId) {
          const tree = this.rbfTrees.get(treeId);
          this.rbfTrees.delete(treeId);
          if (tree) {
            tree.interval = newTime - tree?.time;
            replacedTrees.push(tree);
            fullRbf = fullRbf || tree.fullRbf;
          }
        }
      } else {
        const replacedTime = replacedTxExtended.firstSeen || Date.now();
        replacedTrees.push({
          tx: replacedTx,
          time: replacedTime,
          interval: newTime - replacedTime,
          fullRbf: !replacedTx.rbf,
          replaces: [],
        });
        fullRbf = fullRbf || !replacedTx.rbf;
        this.txs.set(replacedTx.txid, replacedTxExtended);
      }
    }
    const treeId = replacedTrees[0].tx.txid;
    const newTree = {
      tx: newTx,
      time: newTxExtended.firstSeen || Date.now(),
      fullRbf,
      replaces: replacedTrees
    };
    this.rbfTrees.set(treeId, newTree);
    this.updateTreeMap(treeId, newTree);
    this.replaces.set(newTx.txid, replacedTrees.map(tree => tree.tx.txid));
    this.dirtyTrees.add(treeId);
  }

  public getReplacedBy(txId: string): string | undefined {
    return this.replacedBy.get(txId);
  }

  public getReplaces(txId: string): string[] | undefined {
    return this.replaces.get(txId);
  }

  public getTx(txId: string): TransactionExtended | undefined {
    return this.txs.get(txId);
  }

  public getRbfTree(txId: string): RbfTree | void {
    return this.rbfTrees.get(this.treeMap.get(txId) || '');
  }

  // get a paginated list of RbfTrees
  // ordered by most recent replacement time
  public getRbfTrees(onlyFullRbf: boolean, after?: string): RbfTree[] {
    const limit = 25;
    const trees: RbfTree[] = [];
    const used = new Set<string>();
    const replacements: string[][] = Array.from(this.replacedBy).reverse();
    const afterTree = after ? this.treeMap.get(after) : null;
    let ready = !afterTree;
    for (let i = 0; i < replacements.length && trees.length <= limit - 1; i++) {
      const txid = replacements[i][1];
      const treeId = this.treeMap.get(txid) || '';
      if (treeId === afterTree) {
        ready = true;
      } else if (ready) {
        if (!used.has(treeId)) {
          const tree = this.rbfTrees.get(treeId);
          used.add(treeId);
          if (tree && (!onlyFullRbf || tree.fullRbf)) {
            trees.push(tree);
          }
        }
      }
    }
    return trees;
  }

  // get map of rbf trees that have been updated since the last call
  public getRbfChanges(): { trees: {[id: string]: RbfTree }, map: { [txid: string]: string }} {
    const changes: { trees: {[id: string]: RbfTree }, map: { [txid: string]: string }} = {
      trees: {},
      map: {},
    };
    this.dirtyTrees.forEach(id => {
      const tree = this.rbfTrees.get(id);
      if (tree) {
        changes.trees[id] = tree;
        this.getTransactionsInTree(tree).forEach(tx => {
          changes.map[tx.txid] = id;
        });
      }
    });
    this.dirtyTrees = new Set();
    return changes;
  }

  public mined(txid): void {
    const treeId = this.treeMap.get(txid);
    if (treeId && this.rbfTrees.has(treeId)) {
      const tree = this.rbfTrees.get(treeId);
      if (tree) {
        this.setTreeMined(tree, txid);
        tree.mined = true;
        this.dirtyTrees.add(treeId);
      }
    }
    this.evict(txid);
  }

  // flag a transaction as removed from the mempool
  public evict(txid): void {
    this.expiring.set(txid, new Date(Date.now() + 1000 * 86400)); // 24 hours
  }

  private cleanup(): void {
    const currentDate = new Date();
    for (const txid in this.expiring) {
      if ((this.expiring.get(txid) || 0) < currentDate) {
        this.expiring.delete(txid);
        this.remove(txid);
      }
    }
  }

  // remove a transaction & all previous versions from the cache
  private remove(txid): void {
    // don't remove a transaction if a newer version remains in the mempool
    if (!this.replacedBy.has(txid)) {
      const replaces = this.replaces.get(txid);
      this.replaces.delete(txid);
      this.treeMap.delete(txid);
      this.txs.delete(txid);
      this.expiring.delete(txid);
      for (const tx of (replaces || [])) {
        // recursively remove prior versions from the cache
        this.replacedBy.delete(tx);
        // if this is the id of a tree, remove that too
        if (this.treeMap.get(tx) === tx) {
          this.rbfTrees.delete(tx);
        }
        this.remove(tx);
      }
    }
  }

  private updateTreeMap(newId: string, tree: RbfTree): void {
    this.treeMap.set(tree.tx.txid, newId);
    tree.replaces.forEach(subtree => {
      this.updateTreeMap(newId, subtree);
    });
  }

  private getTransactionsInTree(tree: RbfTree, txs: RbfTransaction[] = []): RbfTransaction[] {
    txs.push(tree.tx);
    tree.replaces.forEach(subtree => {
      this.getTransactionsInTree(subtree, txs);
    });
    return txs;
  }

  private setTreeMined(tree: RbfTree, txid: string): void {
    if (tree.tx.txid === txid) {
      tree.tx.mined = true;
    } else {
      tree.replaces.forEach(subtree => {
        this.setTreeMined(subtree, txid);
      });
    }
  }
}

export default new RbfCache();
