koa-bodyparser-ts
=================

[![Greenkeeper badge](https://badges.greenkeeper.io/HKUST-VISLab/koa-bodyparser-ts.svg)](https://greenkeeper.io/)

[![Build Status](https://travis-ci.org/HKUST-VISLab/koa-bodyparser-ts.svg?branch=master)](https://travis-ci.org/HKUST-VISLab/koa-bodyparser-ts)
[![codecov](https://codecov.io/gh/HKUST-VISLab/koa-bodyparser-ts/branch/master/graph/badge.svg)](https://codecov.io/gh/HKUST-VISLab/koa-bodyparser-ts)
[![David](https://david-dm.org/HKUST-VISLab/koa-bodyparser-ts/status.svg)](https://github.com/HKUST-VISLab/koa-bodyparser-ts)


A body parser for koa, base on [co-body](https://github.com/tj/co-body). support `json`, `form` and `text` type body.

## Install

`npm install koa-bodyparser-ts --save`

## Usage

```ts

import * as Koa from "koa";
import bodyParser from "koa-bodyparser-ts";

const app = new Koa();
app.use(bodyParser());

app.use(async ctx => {
  // the parsed body will store in ctx.request.body
  // if nothing was parsed, body will be an empty object {}
  ctx.body = ctx.request.body;
});
```

## Options

* **enableTypes**: parser will only parse when request type hits enableTypes, default is `['json', 'form']`.
* **encode**: requested encoding. Default is `utf-8` by `co-body`.
* **formLimit**: limit of the `urlencoded` body. If the body ends up being larger than this limit, a 413 error code is returned. Default is `56kb`.
* **jsonLimit**: limit of the `json` body. Default is `1mb`.
* **textLimit**: limit of the `text` body. Default is `1mb`.
* **strict**: when set to true, JSON parser will only accept arrays and objects. Default is `true`. See [strict mode](https://github.com/cojs/co-body#options) in `co-body`. In strict mode, `ctx.request.body` will always be an object(or array), this avoid lots of type judging. But text body will always return string type.
* **detectJSON**: custom json request detect function. Default is `null`.

  ```js
  app.use(bodyparser({
    detectJSON: function (ctx) {
      return /\.json$/i.test(ctx.path);
    }
  }));
  ```

* **extendTypes**: support extend types:

  ```js
  app.use(bodyparser({
    extendTypes: {
      json: ['application/x-javascript'] // will parse application/x-javascript type body as a JSON string
    }
  }));
  ```

* **onerror**: support custom error handle, if `koa-bodyparser` throw an error, you can customize the response like:

  ```js
  app.use(bodyparser({
    onerror: function (err, ctx) {
      ctx.throw('body parse error', 422);
    }
  }));
  ```

* **disableBodyParser**: you can dynamic disable body parser by set `ctx.disableBodyParser = true`.

```js
app.use(async (ctx, next) => {
  if (ctx.path === '/disable') ctx.disableBodyParser = true;
  await next();
});
app.use(bodyparser());
```

## Raw Body

You can access raw request body by `ctx.request.rawBody` after `koa-bodyparser` when:

1. `koa-bodyparser` parsed the request body.
2. `ctx.request.rawBody` is not present before `koa-bodyparser`.

## Licences

[MIT](LICENSE)