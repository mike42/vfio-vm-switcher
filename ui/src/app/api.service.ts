import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor() {
  }

  public getHello(): Observable<string> {
    return of("Hello, app.")
  }
}
