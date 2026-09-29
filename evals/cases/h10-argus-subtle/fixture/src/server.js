import http from 'node:http';
import { listNotes, addNote } from './notes.js';
http.createServer(async (req, res) => {
  if (req.url === '/notes' && req.method === 'GET') return res.end(JSON.stringify(listNotes()));
  if (req.url === '/notes' && req.method === 'POST') {
    let body = ''; for await (const c of req) body += c;
    return res.end(JSON.stringify(addNote(JSON.parse(body).text)));
  }
  res.statusCode = 404; res.end();
}).listen(3000);
