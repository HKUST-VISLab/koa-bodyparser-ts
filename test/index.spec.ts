import test from "ava";
import * as Koa from "koa";
import * as request from "supertest";
import bodyparser, { BodyParserOptions } from "../src/index";

const rawJson = `{"_id":"mk2testmodule","name":"mk2testmodule","description":"","dist-tags":{"latest
":"0.0.1"},"versions":{"0.0.1":{"name":"mk2testmodule","version":"0.0.1","description":"","main":"in
dex.js","scripts":{"test":"echo \"Error: no test specified\" && exit 1"},"author":"","license":"ISC",
"readme":"ERROR: No README data found!","_id":"mk2testmodule@0.0.1","dist":{"shasum":"fa475605f88bab
9b1127833633ca3ae0a477224c","tarball":"http://127.0.0.1:7001/mk2testmodule/-/mk2testmodule-0.0.1.tgz
"},"_from":".","_npmVersion":"1.4.3","_npmUser":{"name":"fengmk2","email":"fengmk2@gmail.com"},"main
tainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}]}},"readme":"ERROR: No README data found!",
"maintainers":[{"name":"fengmk2","email":"fengmk2@gmail.com"}],"_attachments":{"mk2testmodule-0.0.1.
tgz":{"content_type":"application/octet-stream","data":"H4sIAAAAAAAAA+2SsWrDMBCGPfspDg2ZinOyEgeylg6Z
u2YR8rVRHEtGkkOg5N0jWaFdujVQAv6W4/7/dHcSGqTq5Ccthxyro7emeDCI2KxWkOKmaaaIdc4TouZQ8FqgwI3AdVMgF8ijho9e
5DdGH6SLq/y1T74LfMcn4asEYEb2xLbA+q4O5ENv2/FE7CVZZ3JeW5NcrLDiWW3JK6eHcHey2Es9Zdq0dIkfKau50EcjjYpCmpDK
SB0s7Nmbc9ZtwVhIBviBlP7Q1O4ZLBZAFx2As3jyOnWTYzhY9zPzpBUZPy2/e39l5bX87wedmZmZeRJuheTX2wAIAAA=","lengt
h":251}}}`;

function makeApp(opt: BodyParserOptions = {}) {
    const app: Koa = new Koa();
    app.use(async (ctx, next) => {
        try {
            await next();
        } catch (err) {
            // will only respond with JSON
            ctx.status = err.statusCode || err.status || 500;
            ctx.response.status = ctx.status;
            ctx.body = {
                message: err.message,
            };
        }
    });
    app.use(bodyparser(opt));
    return app;
}

test("bodyparser#json body", async (t) => {
    const app = makeApp();
    t.truthy(app.use(bodyparser()), "it should work when use body parser again");
    app.use(async (ctx, next) => {
        switch (ctx.request.path) {
            case "/post": {
                t.deepEqual(ctx.request.body, { foo: "bar" }, "/post#body should be a object");
                t.deepEqual(ctx.request.rawBody, '{"foo":"bar"}', "/post#rawBody should be a string");
                // return the parse object
                ctx.body = ctx.request.body;
                break;
            }
            case "/patch": {
                t.deepEqual(ctx.request.body, [{ op: "add", path: "/foo", value: "bar" }],
                    "/patch#body should be a object");
                t.deepEqual(ctx.request.rawBody, '[{"op": "add", "path": "/foo", "value": "bar"}]',
                    "/patch#rawBody should be a string");
                ctx.body = ctx.request.body;
                break;
            }
            default:
                break;
        }

        return await next();
    });

    const req = request(app.listen());
    let res = await (req.post("/post").send({ foo: "bar" }));
    t.deepEqual(res.body, { foo: "bar" }, "should parse json body ok");

    res = await req.post("/post").set("Accept", "application/vnd.api+json")
        .set("Content-type", "application/vnd.api+json")
        .send('{"foo":"bar"}');
    t.deepEqual(res.body, { foo: "bar" }, "should parse json body with json-api headers ok");

    res = await req.patch("/patch").set("Content-type", "application/json-patch+json")
        .send('[{"op": "add", "path": "/foo", "value": "bar"}]');
    t.deepEqual(res.body, [{ op: "add", path: "/foo", value: "bar" }], "should parse json patch");

});

test("bodyparser#json body with limit", async (t) => {
    const app = makeApp({ jsonLimit: 100 });
    app.use(async (ctx, next) => {
        switch (ctx.request.path) {
            case "/valid": {
                ctx.body = ctx.request.body;
                break;
            }
            case "/invalid": {
                t.deepEqual(ctx.request.rawBody, '"invalid"', "/invalid#rawBody should be a string");
            }
            default:
                break;
        }
        await next();
    });

    const req = request(app.listen());
    let res = await req.post("/valid").set("Content-type", "application/json").send(rawJson);
    t.is(res.status, 413, "should json body reach the limit size");

    res = await req.post("/invalid").set("Content-type", "application/json").send('"invalid"');
    t.is(res.status, 400, "should json body error with string in strict mode");

});

test("bodyparser#json body with limit and not strict", async (t) => {
    const app = makeApp({ jsonLimit: 100, strict: false });
    app.use(async (ctx, next) => {
        switch (ctx.request.path) {
            case "/valid": {
                t.deepEqual(ctx.request.rawBody, '"valid"', "/invalid#rawBody should be a string");
                ctx.body = ctx.request.body;
            }
            default:
                break;
        }
        await next();
    });

    const req = request(app.listen());
    const res = await req.post("/valid").set("Content-type", "application/json").send('"valid"');
    t.is(res.status, 200, "should json body ok with string not in strict mode");
    t.is(res.text, "valid", "should json body ok with string not in strict mode");
});

test("bodyparser#opts.detectJSON", async (t) => {
    const app = makeApp({ detectJSON: (ctx) => /\.json/i.test(ctx.request.path) });

    app.use(async (ctx) => {
        if (ctx.request.path === "/foo.json") {
            t.deepEqual(ctx.request.body, { foo: "bar" }, "/#body should be a object");
        }

        t.deepEqual(ctx.request.rawBody, '{"foo":"bar"}', "/#rawBody should be a string");
        ctx.body = ctx.request.body;
    });

    const req = request(app.listen());
    let res = await req.post("/foo.json").send(JSON.stringify({ foo: "bar" }));
    t.deepEqual(res.body, { foo: "bar" }, "should parse json body on /foo.json request");

    res = await req.post("/foo").send(JSON.stringify({ foo: "bar" }));
    t.deepEqual(res.body, { '{"foo":"bar"}': "" }, "should not parse json body on /foo request");
});

test("bodyparser#form body", async (t) => {
    const app = makeApp();
    app.use(async (ctx, next) => {

        t.deepEqual(ctx.request.body, { foo: { bar: "baz" } }, "/post#body should be a object");
        t.deepEqual(ctx.request.rawBody, "foo%5Bbar%5D=baz", "/post#rawBody should be a string");
        // return the parse object
        ctx.body = ctx.request.body;

        return await next();
    });

    const req = request(app.listen());
    const res = await req.post("/").type("form").send({ foo: { bar: "baz" } });
    t.deepEqual(res.body, { foo: { bar: "baz" } }, "should parse form body ok");
});

test("bodyparser#form body with limit", async (t) => {
    const app = makeApp({ formLimit: 10 });

    const req = request(app.listen());
    const res = await req.post("/").type("form").send({ foo: { bar: "bazzzzzzzzzzzzzzzzzzzzzzzzzzz" } });
    t.is(res.status, 413, "should parse form body reach the limit size");
});

test("bodyparser#text body", async (t) => {
    const app = makeApp({ enableTypes: ["text", "json"] });
    app.use(async (ctx) => {
        t.deepEqual(ctx.request.body, "body", "/#body should be a string");
        t.deepEqual(ctx.request.rawBody, "body", "/#rawBody should be a string");
        ctx.body = ctx.request.body;
    });

    const req = request(app.listen());
    const res = await req.post("/").type("text").send("body");
    t.deepEqual(res.text, "body", "should parse text body ok");

});

test("bodyparser#text body diable", async (t) => {
    const app = makeApp();
    app.use(async (ctx) => {
        ctx.body = ctx.request.body;
    });

    const req = request(app.listen());
    const res = await req.post("/").type("text").send("body");
    t.deepEqual(res.body, {}, "should not parse text body when disable");
});

test("bodyparser#extent type", async (t) => {
    const app = makeApp({ extendTypes: { json: "application/x-javascript" } });
    app.use(async (ctx) => {
        ctx.body = ctx.request.body;
    });

    const req = request(app.listen());
    const res = await req.post("/").type("application/x-javascript")
        .send(JSON.stringify({
            foo: "bar",
        }));
    t.deepEqual(res.body, { foo: "bar" }, "should extent json ok");
});

test("bodyparser#extent type with array", async (t) => {
    const app = makeApp({ extendTypes: { json: ["application/x-javascript", "application/y-javascript"] } });
    app.use(async (ctx) => {
        ctx.body = ctx.request.body;
    });

    const req = request(app.listen());
    const res = await req.post("/").type("application/x-javascript")
        .send(JSON.stringify({
            foo: "bar",
        }));
    t.deepEqual(res.body, { foo: "bar" }, "should extent json with array ok");
});

test("bodyparser#enableTypes", async (t) => {
    const app = makeApp({ enableTypes: ["form"] });
    app.use(async (ctx) => {
        ctx.body = ctx.request.body;
    });

    const req = request(app.listen());
    const res = await req.post("/").type("json")
        .send({ foo: "bar" });
    t.deepEqual(res.body, {}, "should disable json success");
});

test("bodyparser#other type", async (t) => {
    const app = makeApp();
    app.use(async (ctx) => {
        t.deepEqual(ctx.request.body, {}, "/#body should be an object");
        ctx.body = ctx.request.body;
    });

    const req = request(app.listen());
    const res = await req.get("/");
    t.deepEqual(res.body, {}, "should get body null");
});

test("bodyparser#onerror", async (t) => {
    const app = makeApp({ onerror: (err, ctx) => { ctx.throw("custom parse error", 422); } });
    app.use(async (ctx) => { console.info("empty middleware"); });

    const req = request(app.listen());
    const res = await req.post("/")
        .send("test")
        .set("content-type", "application/json");
    t.is(res.status, 422, "should get custom error message");
});

test("bodyparser#disableBodyParser", async (t) => {
    const app = new Koa();
    app.use(async (ctx, next) => {
        ctx.disableBodyParser = true;
        await next();
    });
    app.use(bodyparser());
    app.use(async (ctx) => {
        t.falsy(ctx.request.rawBody, "/#the rawBody should be undefined");
        ctx.body = ctx.request.body ? "parsed" : "empty";
    });

    const req = request(app.listen());
    const res = await req.post("/")
        .send({ foo: "bar" })
        .set("content-type", "application/json");
    t.is(res.status, 200, "should get empty return");
    t.deepEqual(res.text, "empty", "should not parse body when disableBodyParser set to true");
});
