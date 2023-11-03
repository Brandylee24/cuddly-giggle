import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { BlockchainComponent } from './blockchain/blockchain.component';
import { AboutComponent } from './about/about.component';
import { StatisticsComponent } from './statistics/statistics.component';
import { TelevisionComponent } from './television/television.component';
import { MasterPageComponent } from './master-page/master-page.component';

const routes: Routes = [
  {
    path: '',
    component: MasterPageComponent,
    children: [
      {
        path: '',
        children: [],
        component: BlockchainComponent
      },
      {
        path: 'tx/:id',
        children: [],
        component: BlockchainComponent
      },
      {
        path: 'about',
        children: [],
        component: AboutComponent
      },
      {
        path: 'statistics',
        component: StatisticsComponent,
      },
      {
        path: 'graphs',
        component: StatisticsComponent,
      },
      {
        path: 'explorer',
        loadChildren: './explorer/explorer.module#ExplorerModule',
      },
    ],
  },
  {
    path: 'tv',
    component: TelevisionComponent,
  },
  {
    path: '**',
    redirectTo: ''
  }
];
@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
