import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';
import {HttpClient} from "@angular/common/http";

export interface StatusResponse {
  message: string
}

export interface DomainSummary {
  id: number;
  uuid: string
  autostart: boolean;
  state: string;
  name: string;
  title: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private http: HttpClient) {
  }

  public getDomains(): Observable<DomainSummary[]> {
    return this.http.get<DomainSummary[]>("/api/domain");
  }

  switchTo(name: string) {
      return this.http.patch<StatusResponse[]>("/api/domain/" + name, {
        state: "RUNNING"
      });
  }

  hostPoweroff() {
      return this.http.patch<StatusResponse[]>("/api/host", {
        state: "SHUTOFF"
      });
  }
}
