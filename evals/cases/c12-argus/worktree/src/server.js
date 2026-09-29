import http from 'node:http';
import { listNotes, addNote } from './notes.js';
import { toCsv } from './csv.js';
http.createServer(async (req, res) => {
  if (req.url === '/notes' && req.method === 'GET') return res.end(JSON.stringify(listNotes()));
  if (req.url === '/notes' && req.method === 'POST') {
    let body = ''; for await (const c of req) body += c;
    return res.end(JSON.stringify(addNote(JSON.parse(body).text)));
  }
  if (req.url === '/notes.csv') {
    res.setHeader('content-type', 'text/csv');
    return res.end(toCsv(listNotes()));
  }
  res.statusCode = 404; res.end();
}).listen(3000);
