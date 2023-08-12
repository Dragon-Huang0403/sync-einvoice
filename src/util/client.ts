import axios from 'axios';
import {wrapper} from 'axios-cookiejar-support';
import {CookieJar} from 'tough-cookie';

export function createClient() {
  const jar = new CookieJar();
  const client = wrapper(axios.create({jar}));
  return client;
}
