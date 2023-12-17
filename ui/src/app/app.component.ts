import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {ApiService} from "./api.service";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'ui';
  helloText: string | null = null;

  constructor(private apiService: ApiService) {
  }

  ngOnInit(): void {
    this.apiService.getHello().subscribe(x => {
      this.helloText = x;
    })
  }
}
