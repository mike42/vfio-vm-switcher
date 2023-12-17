import {Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {ApiService, DomainSummary} from "./api.service";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatTableModule} from "@angular/material/table";
import {MatIconModule} from "@angular/material/icon";
import {MatButtonModule} from "@angular/material/button";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatToolbarModule} from "@angular/material/toolbar";

import _ from "lodash";
import {Observable, retry, share, Subject, switchMap, takeUntil, timer} from "rxjs";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MatTableModule, MatIconModule, MatButtonModule, MatTooltipModule, MatToolbarModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  domainList: DomainSummary[] | null = null;
  displayedColumns: string[] = ['name', 'action'];

  private domainFeed: Observable<DomainSummary[]> | null = null;
  private stopDomainFeed = new Subject();

  constructor(private apiService: ApiService) {
  }

  ngOnInit() {
    this.domainFeed = timer(1, 1500).pipe(
      switchMap(() => this.apiService.getDomains()),
      retry({delay: 3000}),
      takeUntil(this.stopDomainFeed)
    );
    this.domainFeed.subscribe(data => {
      if (!_.isEqual(data, this.domainList)) {
        // Update only when changed
        this.domainList = data;
      }
    })
  }

  ngOnDestroy() {
    this.stopDomainFeed.next({});
  }

  switchTo(domain: DomainSummary) {
    this.apiService.switchTo(domain.name).subscribe(result => {
      // Ignore response
    });
  }

  hostPoweroff() {
    this.apiService.hostPoweroff().subscribe(result => {
      // Ignore response
    });
  }
}
