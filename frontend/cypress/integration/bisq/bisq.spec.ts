describe('Bisq', () => {
    beforeEach(() => {

        cy.intercept('/sockjs-node/info*').as('socket');
        cy.intercept('/bisq/api/markets/hloc?market=btc_usd&interval=day').as('hloc');
        cy.intercept('/bisq/api/markets/ticker').as('ticker');
        cy.intercept('/bisq/api/markets/markets').as('markets');
        cy.intercept('/bisq/api/markets/volumes/7d').as('7d');
        cy.intercept('/bisq/api/markets/trades?market=all').as('trades');
        cy.intercept('/bisq/api/txs/*/*').as('txs');
        cy.intercept('/bisq/api/blocks/*/*').as('blocks');
        cy.intercept('/bisq/api/stats').as('stats');
    });
    it('loads the dashboard', () => {
      cy.visit('/bisq');

      cy.wait('@socket');
      cy.wait('@hloc');
      cy.wait('@ticker');
      cy.wait('@markets');
      cy.wait('@7d');
      cy.wait('@trades');
    });

    it('loads the transactions screen', () => {
        cy.visit('/bisq');
        cy.get('li:nth-of-type(2) > a').click().then(() => {
            cy.wait('@txs');
        });
    });
    it('loads the blocks screen', () => {
        cy.visit('/bisq');
        cy.get('li:nth-of-type(3) > a').click().then(() => {
            cy.wait('@blocks');
        });
    });
    it('loads the stats screen', () => {
        cy.visit('/bisq');
        cy.get('li:nth-of-type(4) > a').click().then(() => {
            cy.wait('@stats');
        });
    });

    it('loads the api screen', () => {
        cy.visit('/bisq');
        cy.get('li:nth-of-type(5) > a').click().then(() => {

        });
    });

  });
