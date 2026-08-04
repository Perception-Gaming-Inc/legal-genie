'use strict';
/**
 * Minimal dependency-free HTTP router.
 * Supports path params like /api/cases/:id and JSON body parsing.
 */

function compilePath(path) {
  const paramNames = [];
  const pattern = path
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      if (seg.startsWith(':')) {
        paramNames.push(seg.slice(1));
        return '([^/]+)';
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^/${pattern}/?$`), paramNames };
}

class Router {
  constructor() {
    this.routes = [];
  }

  add(method, path, ...handlers) {
    const { regex, paramNames } = compilePath(path);
    this.routes.push({ method: method.toUpperCase(), regex, paramNames, handlers });
    return this;
  }

  get(path, ...h) { return this.add('GET', path, ...h); }
  post(path, ...h) { return this.add('POST', path, ...h); }
  put(path, ...h) { return this.add('PUT', path, ...h); }
  patch(path, ...h) { return this.add('PATCH', path, ...h); }
  delete(path, ...h) { return this.add('DELETE', path, ...h); }

  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) continue;
      const m = route.regex.exec(pathname);
      if (m) {
        const params = {};
        route.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]); });
        return { handlers: route.handlers, params };
      }
    }
    return null;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const MAX = 25 * 1024 * 1024; // 25MB cap (covers base64 file uploads)
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        resolve({}); // tolerate non-JSON bodies
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

module.exports = { Router, readBody, sendJson };
