import * as parse from "co-body";
import { Context } from "koa";

declare module "koa" {
    export interface Context {
        disableBodyParser?: boolean;
    }
    export interface Request {
        rawBody: string;
        body: any;
    }
}

/**
 * @param [Object] opts
 *   - {String[]} parser will only parse when request type hits enableTypes, default is ['json', 'form'].
 *   - {string} encoding default 'utf-8'
 *   - {String} formLimit default '56kb'
 *   - {String} jsonLimit default '1mb'
 *   - {String} textLimit default '1mb'
 *   - {String} strict when set to true, JSON parser will only accept arrays and objects. Default is
 *       true. See strict mode in co-body. In strict mode, ctx.request.body will always be an
 *       object(or array), this avoid lots of type judging. But text body will always return string type.
 *   - {Function} detectJSON custom json request detect function. Default is null.
 *   - {Object} extendTypes support extend types
 *   - {Function} onerror support custom error handle, if koa-bodyparser throw an error, you can customize
 *       the response.
 */
export interface BodyParserOptions {
    enableTypes?: string[];
    encode?: string;
    formLimit?: string | number;
    jsonLimit?: string | number;
    textLimit?: string | number;
    strict?: boolean;
    detectJSON?: (ctx: Context) => boolean;
    extendTypes?: {
        json?: string | string[];
        form?: string | string[];
        text?: string | string[];
    };
    onerror?: (err: Error, ctx: Context) => void;
}

function formatOptions(opts, type) {
    const res = Object.assign({}, opts, { limit: opts[type + "Limit"] });
    return res;
}

function extendType(original, extend) {
    if (extend) {
        if (!Array.isArray(extend)) {
            extend = [extend];
        }
        return original.concat(extend);
    }
    return original;
}

export default function bodyParser(opts: BodyParserOptions = {}) {
    const { detectJSON, onerror } = opts;

    const enableTypes = (opts.enableTypes && new Set(opts.enableTypes)) || new Set(["json", "form"]);
    const enableForm = enableTypes.has("form"); // checkEnable(enableTypes, "form");
    const enableJson = enableTypes.has("json"); // checkEnable(enableTypes, "json");
    const enableText = enableTypes.has("text"); // checkEnable(enableTypes, "text");

    opts.detectJSON = undefined;
    opts.onerror = undefined;
    (opts as any).returnRawBody = true;
    const jsonOpts = formatOptions(opts, "json");
    const formOpts = formatOptions(opts, "form");
    const textOpts = formatOptions(opts, "text");

    const extendTypes = opts.extendTypes || { json: null, form: null, text: null };

    const jsonTypes = extendType([
        "application/json",
        "application/json-patch+json",
        "application/vnd.api+json",
        "application/csp-report",
    ], extendTypes.json);

    const formTypes = extendType([
        "application/x-www-form-urlencoded",
    ], extendTypes.form);

    const textTypes = extendType([
        "text/plain",
    ], extendTypes.text);

    return async function bodyParser(ctx: Context, next) {
        if (ctx.request.body !== undefined) {
            return await next();
        }
        if (ctx.disableBodyParser) {
            return await next();
        }
        try {
            const res = await parseBody(ctx);
            ctx.request.body = "parsed" in res ? res.parsed : {};
            ctx.request.rawBody = res.raw;
        } catch (err) {
            if (onerror) {
                onerror(err, ctx);
            } else {
                throw err;
            }
        }
        await next();
    };

    async function parseBody(ctx: Context) {
        if (enableJson && ((detectJSON && detectJSON(ctx)) || ctx.request.is(jsonTypes))) {
            return await parse.json(ctx, jsonOpts);
        }
        if (enableForm && ctx.request.is(formTypes)) {
            return await parse.form(ctx, formOpts);
        }
        if (enableText && ctx.request.is(textTypes)) {
            return await parse.text(ctx, textOpts);
        }
        return {};
    }
}
