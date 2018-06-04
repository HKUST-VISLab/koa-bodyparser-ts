import * as parse from "co-body";
import * as forms from "formidable";
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
 *  The options
 *
 *   - {number} bytesExpected, The expected number of bytes in this form, default `null`
 *   - {number} maxFields, Limits the number of fields that the querystring parser will decode, default `1000`
 *   - {number} maxFieldsSize, Limits the amount of memory all fields together (except files) can allocate in bytes.
 *              If this value is exceeded, an 'error' event is emitted, default `2mb (2 * 1024 * 1024)`
 *   - {String} uploadDir, Sets the directory for placing file uploads in, default `os.tmpDir()`
 *   - {Boolean} keepExtensions, Files written to `uploadDir` will include the extensions of the original files,
 *               default `false`
 *   - {String} hash, If you want checksums calculated for incoming files, set this to either `'sha1'` or `'md5'`,
 *              default `false`
 *   - {Boolean} multiples, Multiple file uploads or no, default `true`
 *   - {Function} onFileBegin, Special callback on file begin. The function is executed directly by formidable.
 *                It can be used to rename files before saving them to disk.
 *                [See the docs](https://github.com/felixge/node-formidable#filebegin)
 * @export
 * @interface MultiPartOptions
 */
export interface MultiPartOptions {
    bytesExpected?: number;
    maxFields?: number;
    maxFieldsSize?: number;
    uploadDir?: string | { [path: string]: string };
    keepExtensions?: boolean;
    hash?: "sha1" | "md5";
    multiples?: boolean;
    onFileBegin?: (name: string, file: { name: string; path: string; }) => void;
}

/**
 *  The options
 *
 *   - {String[]} enableTypes, parser will only parse when request type hits enableTypes, default is ['json', 'form'].
 *   - {String} encode, default 'utf-8'
 *   - {String} formLimit, default '56kb'
 *   - {String} jsonLimit, default '1mb'
 *   - {String} textLimit, default '1mb'
 *   - {String} strict when set to true, JSON parser will only accept arrays and objects. Default is
 *       true. See strict mode in co-body. In strict mode, ctx.request.body will always be an
 *       object(or array), this avoid lots of type judging. But text body will always return string type.
 *   - {Function} detectJSON custom json request detect function. Default is null.
 *   - {Object} extendTypes support extend types
 *   - {Function} onerror support custom error handle, if koa-bodyparser throw an error, you can customize
 *       the response.
 * @export
 * @interface BodyParserOptions
 */
export interface BodyParserOptions {
    enableTypes?: string[];
    encode?: string;
    formLimit?: string | number;
    jsonLimit?: string | number;
    textLimit?: string | number;
    multipartOptions?: MultiPartOptions;
    strict?: boolean;
    detectJSON?: (ctx: Context) => boolean;
    extendTypes?: {
        json?: string | string[];
        form?: string | string[];
        text?: string | string[];
        multipart?: string | string[];
    };
    onerror?: (err: Error, ctx: Context) => void;
}

/**
 *
 *
 * @param {BodyParserOptions} opts
 * @param {string} type
 * @returns
 */
function formatOptions(opts: BodyParserOptions, type: string) {
    const res = Object.assign({}, opts, { limit: opts[type + "Limit"] });
    return res;
}

/**
 * Donable formidable
 *
 * @param  {Stream} ctx
 * @param  {Object} opts
 * @return {Object}
 * @api private
 */
async function formy(ctx, opts) {
    return new Promise((resolve, reject) => {
        const fields = {};
        const files = {};
        const form = new forms.IncomingForm(opts);
        form.on("end", () => resolve({ fields, files }))
            .on("error", (err) => reject(err))
            .on("field", (field, value) => {
                if (fields[field]) {
                    if (Array.isArray(fields[field])) {
                        fields[field].push(value);
                    } else {
                        fields[field] = [fields[field], value];
                    }
                } else {
                    fields[field] = value;
                }
            })
            .on("file", (field, file) => {
                if (files[field]) {
                    if (Array.isArray(files[field])) {
                        files[field].push(file);
                    } else {
                        files[field] = [files[field], file];
                    }
                } else {
                    files[field] = file;
                }
            });
        if (opts.onFileBegin) {
            form.on("fileBegin", opts.onFileBegin);
        }
        form.parse(ctx.req);
    });
}

export default function bodyParser(opts: BodyParserOptions = {}) {
    const { detectJSON, onerror, multipartOptions = {} } = opts;

    const enableTypes = (opts.enableTypes && new Set(opts.enableTypes)) || new Set(["json", "form"]);
    const enableForm = enableTypes.has("form"); // checkEnable(enableTypes, "form");
    const enableJson = enableTypes.has("json"); // checkEnable(enableTypes, "json");
    const enableText = enableTypes.has("text"); // checkEnable(enableTypes, "text");
    const enableMultipart = enableTypes.has("multipart");

    opts.detectJSON = undefined;
    opts.onerror = undefined;
    (opts as any).returnRawBody = true;
    const jsonOpts = formatOptions(opts, "json");
    const formOpts = formatOptions(opts, "form");
    const textOpts = formatOptions(opts, "text");
    const multipartOpts = multipartOptions;

    const extendTypes = opts.extendTypes || { json: [], form: [], text: [], multipart: [] };

    const jsonTypes = [
        "application/json",
        "application/json-patch+json",
        "application/vnd.api+json",
        "application/csp-report",
        ...Array.isArray(extendTypes.json) ? extendTypes.json : [extendTypes.json],
    ];

    const formTypes = [
        "application/x-www-form-urlencoded",
        ...Array.isArray(extendTypes.form) ? extendTypes.form : [extendTypes.form],
    ];

    const textTypes = [
        "text/plain",
        ...Array.isArray(extendTypes.text) ? extendTypes.text : [extendTypes.text],
    ];

    const multipartTypes = [
        "multipart/form-data",
        ...Array.isArray(extendTypes.multipart) ? extendTypes.multipart : [extendTypes.multipart],
    ];

    return async (ctx: Context, next) => {
        if (ctx.request.body !== undefined) {
            return await next();
        }
        if (ctx.disableBodyParser) {
            return await next();
        }
        try {
            const res = await parseBody(ctx);
            ctx.request.body = "parsed" in res ? res.parsed : res;
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
        if (enableForm && ctx.is(formTypes)) {
            return await parse.form(ctx, formOpts);
        }
        if (enableText && ctx.is(textTypes)) {
            return await parse.text(ctx, textOpts);
        }
        if (enableMultipart && ctx.is(multipartTypes)) {
            if (typeof multipartOptions.uploadDir === "object") {
                const newOpts = { ...multipartOptions };
                newOpts.uploadDir = multipartOptions.uploadDir[ctx.path];
                return await formy(ctx, newOpts);
            } else {
                return await formy(ctx, multipartOpts);
            }
        }
        return {};
    }
}
