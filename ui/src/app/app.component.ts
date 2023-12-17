import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {ApiService, DomainSummary} from "./api.service";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatTableModule} from "@angular/material/table";
import {MatIconModule} from "@angular/material/icon";
import {MatButtonModule} from "@angular/material/button";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatToolbarModule} from "@angular/material/toolbar";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MatSlideToggleModule, MatTableModule, MatIconModule, MatButtonModule, MatTooltipModule, MatToolbarModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  domainList: DomainSummary[] | null = null;
  displayedColumns: string[] = ['name', 'action'];

  constructor(private apiService: ApiService) {
  }

  ngOnInit(): void {
    this.apiService.getDomains().subscribe(data => {
      this.domainList = data;
    })
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
