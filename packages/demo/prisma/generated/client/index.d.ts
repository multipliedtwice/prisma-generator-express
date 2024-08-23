
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model UserAccount
 * generator off
 */
export type UserAccount = $Result.DefaultSelection<Prisma.$UserAccountPayload>
/**
 * Model orderItem
 * 
 */
export type orderItem = $Result.DefaultSelection<Prisma.$orderItemPayload>
/**
 * Model PRODUCT_CATALOG
 * 
 */
export type PRODUCT_CATALOG = $Result.DefaultSelection<Prisma.$PRODUCT_CATALOGPayload>
/**
 * Model INVOICE_RECORDS
 * 
 */
export type INVOICE_RECORDS = $Result.DefaultSelection<Prisma.$INVOICE_RECORDSPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const productCategory: {
  ELECTRONICS: 'ELECTRONICS',
  FURNITURE: 'FURNITURE',
  CLOTHING: 'CLOTHING'
};

export type productCategory = (typeof productCategory)[keyof typeof productCategory]

}

export type productCategory = $Enums.productCategory

export const productCategory: typeof $Enums.productCategory

/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more UserAccounts
 * const userAccounts = await prisma.userAccount.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more UserAccounts
   * const userAccounts = await prisma.userAccount.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb, ExtArgs>

      /**
   * `prisma.userAccount`: Exposes CRUD operations for the **UserAccount** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more UserAccounts
    * const userAccounts = await prisma.userAccount.findMany()
    * ```
    */
  get userAccount(): Prisma.UserAccountDelegate<ExtArgs>;

  /**
   * `prisma.orderItem`: Exposes CRUD operations for the **orderItem** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more OrderItems
    * const orderItems = await prisma.orderItem.findMany()
    * ```
    */
  get orderItem(): Prisma.orderItemDelegate<ExtArgs>;

  /**
   * `prisma.pRODUCT_CATALOG`: Exposes CRUD operations for the **PRODUCT_CATALOG** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PRODUCT_CATALOGS
    * const pRODUCT_CATALOGS = await prisma.pRODUCT_CATALOG.findMany()
    * ```
    */
  get pRODUCT_CATALOG(): Prisma.PRODUCT_CATALOGDelegate<ExtArgs>;

  /**
   * `prisma.iNVOICE_RECORDS`: Exposes CRUD operations for the **INVOICE_RECORDS** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more INVOICE_RECORDS
    * const iNVOICE_RECORDS = await prisma.iNVOICE_RECORDS.findMany()
    * ```
    */
  get iNVOICE_RECORDS(): Prisma.INVOICE_RECORDSDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError
  export import NotFoundError = runtime.NotFoundError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql

  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 5.18.0
   * Query Engine version: 4c784e32044a8a016d99474bd02a3b6123742169
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */

  /**
   * From https://github.com/sindresorhus/type-fest/
   * Matches a JSON object.
   * This type can be useful to enforce some input to be JSON-compatible or as a super-type to be extended from. 
   */
  export type JsonObject = {[Key in string]?: JsonValue}

  /**
   * From https://github.com/sindresorhus/type-fest/
   * Matches a JSON array.
   */
  export interface JsonArray extends Array<JsonValue> {}

  /**
   * From https://github.com/sindresorhus/type-fest/
   * Matches any valid JSON value.
   */
  export type JsonValue = string | number | boolean | JsonObject | JsonArray | null

  /**
   * Matches a JSON object.
   * Unlike `JsonObject`, this type allows undefined and read-only properties.
   */
  export type InputJsonObject = {readonly [Key in string]?: InputJsonValue | null}

  /**
   * Matches a JSON array.
   * Unlike `JsonArray`, readonly arrays are assignable to this type.
   */
  export interface InputJsonArray extends ReadonlyArray<InputJsonValue | null> {}

  /**
   * Matches any valid value that can be used as an input for operations like
   * create and update as the value of a JSON field. Unlike `JsonValue`, this
   * type allows read-only arrays and read-only object properties and disallows
   * `null` at the top level.
   *
   * `null` cannot be used as the value of a JSON field because its meaning
   * would be ambiguous. Use `Prisma.JsonNull` to store the JSON null value or
   * `Prisma.DbNull` to clear the JSON value and set the field to the database
   * NULL value instead.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-by-null-values
   */
  export type InputJsonValue = string | number | boolean | InputJsonObject | InputJsonArray | { toJSON(): unknown }

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? K : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    UserAccount: 'UserAccount',
    orderItem: 'orderItem',
    PRODUCT_CATALOG: 'PRODUCT_CATALOG',
    INVOICE_RECORDS: 'INVOICE_RECORDS'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.InternalArgs, clientOptions: PrismaClientOptions }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], this['params']['clientOptions']>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> = {
    meta: {
      modelProps: "userAccount" | "orderItem" | "pRODUCT_CATALOG" | "iNVOICE_RECORDS"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      UserAccount: {
        payload: Prisma.$UserAccountPayload<ExtArgs>
        fields: Prisma.UserAccountFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserAccountFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAccountPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserAccountFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAccountPayload>
          }
          findFirst: {
            args: Prisma.UserAccountFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAccountPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserAccountFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAccountPayload>
          }
          findMany: {
            args: Prisma.UserAccountFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAccountPayload>[]
          }
          create: {
            args: Prisma.UserAccountCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAccountPayload>
          }
          createMany: {
            args: Prisma.UserAccountCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserAccountCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAccountPayload>[]
          }
          delete: {
            args: Prisma.UserAccountDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAccountPayload>
          }
          update: {
            args: Prisma.UserAccountUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAccountPayload>
          }
          deleteMany: {
            args: Prisma.UserAccountDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserAccountUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.UserAccountUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserAccountPayload>
          }
          aggregate: {
            args: Prisma.UserAccountAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUserAccount>
          }
          groupBy: {
            args: Prisma.UserAccountGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserAccountGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserAccountCountArgs<ExtArgs>
            result: $Utils.Optional<UserAccountCountAggregateOutputType> | number
          }
        }
      }
      orderItem: {
        payload: Prisma.$orderItemPayload<ExtArgs>
        fields: Prisma.orderItemFieldRefs
        operations: {
          findUnique: {
            args: Prisma.orderItemFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$orderItemPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.orderItemFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$orderItemPayload>
          }
          findFirst: {
            args: Prisma.orderItemFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$orderItemPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.orderItemFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$orderItemPayload>
          }
          findMany: {
            args: Prisma.orderItemFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$orderItemPayload>[]
          }
          create: {
            args: Prisma.orderItemCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$orderItemPayload>
          }
          createMany: {
            args: Prisma.orderItemCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.orderItemCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$orderItemPayload>[]
          }
          delete: {
            args: Prisma.orderItemDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$orderItemPayload>
          }
          update: {
            args: Prisma.orderItemUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$orderItemPayload>
          }
          deleteMany: {
            args: Prisma.orderItemDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.orderItemUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.orderItemUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$orderItemPayload>
          }
          aggregate: {
            args: Prisma.OrderItemAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateOrderItem>
          }
          groupBy: {
            args: Prisma.orderItemGroupByArgs<ExtArgs>
            result: $Utils.Optional<OrderItemGroupByOutputType>[]
          }
          count: {
            args: Prisma.orderItemCountArgs<ExtArgs>
            result: $Utils.Optional<OrderItemCountAggregateOutputType> | number
          }
        }
      }
      PRODUCT_CATALOG: {
        payload: Prisma.$PRODUCT_CATALOGPayload<ExtArgs>
        fields: Prisma.PRODUCT_CATALOGFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PRODUCT_CATALOGFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PRODUCT_CATALOGPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PRODUCT_CATALOGFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PRODUCT_CATALOGPayload>
          }
          findFirst: {
            args: Prisma.PRODUCT_CATALOGFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PRODUCT_CATALOGPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PRODUCT_CATALOGFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PRODUCT_CATALOGPayload>
          }
          findMany: {
            args: Prisma.PRODUCT_CATALOGFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PRODUCT_CATALOGPayload>[]
          }
          create: {
            args: Prisma.PRODUCT_CATALOGCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PRODUCT_CATALOGPayload>
          }
          createMany: {
            args: Prisma.PRODUCT_CATALOGCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PRODUCT_CATALOGCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PRODUCT_CATALOGPayload>[]
          }
          delete: {
            args: Prisma.PRODUCT_CATALOGDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PRODUCT_CATALOGPayload>
          }
          update: {
            args: Prisma.PRODUCT_CATALOGUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PRODUCT_CATALOGPayload>
          }
          deleteMany: {
            args: Prisma.PRODUCT_CATALOGDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PRODUCT_CATALOGUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.PRODUCT_CATALOGUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PRODUCT_CATALOGPayload>
          }
          aggregate: {
            args: Prisma.PRODUCT_CATALOGAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePRODUCT_CATALOG>
          }
          groupBy: {
            args: Prisma.PRODUCT_CATALOGGroupByArgs<ExtArgs>
            result: $Utils.Optional<PRODUCT_CATALOGGroupByOutputType>[]
          }
          count: {
            args: Prisma.PRODUCT_CATALOGCountArgs<ExtArgs>
            result: $Utils.Optional<PRODUCT_CATALOGCountAggregateOutputType> | number
          }
        }
      }
      INVOICE_RECORDS: {
        payload: Prisma.$INVOICE_RECORDSPayload<ExtArgs>
        fields: Prisma.INVOICE_RECORDSFieldRefs
        operations: {
          findUnique: {
            args: Prisma.INVOICE_RECORDSFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$INVOICE_RECORDSPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.INVOICE_RECORDSFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$INVOICE_RECORDSPayload>
          }
          findFirst: {
            args: Prisma.INVOICE_RECORDSFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$INVOICE_RECORDSPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.INVOICE_RECORDSFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$INVOICE_RECORDSPayload>
          }
          findMany: {
            args: Prisma.INVOICE_RECORDSFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$INVOICE_RECORDSPayload>[]
          }
          create: {
            args: Prisma.INVOICE_RECORDSCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$INVOICE_RECORDSPayload>
          }
          createMany: {
            args: Prisma.INVOICE_RECORDSCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.INVOICE_RECORDSCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$INVOICE_RECORDSPayload>[]
          }
          delete: {
            args: Prisma.INVOICE_RECORDSDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$INVOICE_RECORDSPayload>
          }
          update: {
            args: Prisma.INVOICE_RECORDSUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$INVOICE_RECORDSPayload>
          }
          deleteMany: {
            args: Prisma.INVOICE_RECORDSDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.INVOICE_RECORDSUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.INVOICE_RECORDSUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$INVOICE_RECORDSPayload>
          }
          aggregate: {
            args: Prisma.INVOICE_RECORDSAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateINVOICE_RECORDS>
          }
          groupBy: {
            args: Prisma.INVOICE_RECORDSGroupByArgs<ExtArgs>
            result: $Utils.Optional<INVOICE_RECORDSGroupByOutputType>[]
          }
          count: {
            args: Prisma.INVOICE_RECORDSCountArgs<ExtArgs>
            result: $Utils.Optional<INVOICE_RECORDSCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
  }


  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserAccountCountOutputType
   */

  export type UserAccountCountOutputType = {
    orders: number
  }

  export type UserAccountCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    orders?: boolean | UserAccountCountOutputTypeCountOrdersArgs
  }

  // Custom InputTypes
  /**
   * UserAccountCountOutputType without action
   */
  export type UserAccountCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAccountCountOutputType
     */
    select?: UserAccountCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserAccountCountOutputType without action
   */
  export type UserAccountCountOutputTypeCountOrdersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: orderItemWhereInput
  }


  /**
   * Count Type OrderItemCountOutputType
   */

  export type OrderItemCountOutputType = {
    INVOICE_RECORDS: number
  }

  export type OrderItemCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    INVOICE_RECORDS?: boolean | OrderItemCountOutputTypeCountINVOICE_RECORDSArgs
  }

  // Custom InputTypes
  /**
   * OrderItemCountOutputType without action
   */
  export type OrderItemCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OrderItemCountOutputType
     */
    select?: OrderItemCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * OrderItemCountOutputType without action
   */
  export type OrderItemCountOutputTypeCountINVOICE_RECORDSArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: INVOICE_RECORDSWhereInput
  }


  /**
   * Models
   */

  /**
   * Model UserAccount
   */

  export type AggregateUserAccount = {
    _count: UserAccountCountAggregateOutputType | null
    _avg: UserAccountAvgAggregateOutputType | null
    _sum: UserAccountSumAggregateOutputType | null
    _min: UserAccountMinAggregateOutputType | null
    _max: UserAccountMaxAggregateOutputType | null
  }

  export type UserAccountAvgAggregateOutputType = {
    ID: number | null
  }

  export type UserAccountSumAggregateOutputType = {
    ID: number | null
  }

  export type UserAccountMinAggregateOutputType = {
    ID: number | null
    full_name: string | null
    emailAddress: string | null
    createdAt: Date | null
  }

  export type UserAccountMaxAggregateOutputType = {
    ID: number | null
    full_name: string | null
    emailAddress: string | null
    createdAt: Date | null
  }

  export type UserAccountCountAggregateOutputType = {
    ID: number
    full_name: number
    emailAddress: number
    createdAt: number
    _all: number
  }


  export type UserAccountAvgAggregateInputType = {
    ID?: true
  }

  export type UserAccountSumAggregateInputType = {
    ID?: true
  }

  export type UserAccountMinAggregateInputType = {
    ID?: true
    full_name?: true
    emailAddress?: true
    createdAt?: true
  }

  export type UserAccountMaxAggregateInputType = {
    ID?: true
    full_name?: true
    emailAddress?: true
    createdAt?: true
  }

  export type UserAccountCountAggregateInputType = {
    ID?: true
    full_name?: true
    emailAddress?: true
    createdAt?: true
    _all?: true
  }

  export type UserAccountAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserAccount to aggregate.
     */
    where?: UserAccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserAccounts to fetch.
     */
    orderBy?: UserAccountOrderByWithRelationInput | UserAccountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserAccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserAccounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserAccounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned UserAccounts
    **/
    _count?: true | UserAccountCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UserAccountAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UserAccountSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserAccountMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserAccountMaxAggregateInputType
  }

  export type GetUserAccountAggregateType<T extends UserAccountAggregateArgs> = {
        [P in keyof T & keyof AggregateUserAccount]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUserAccount[P]>
      : GetScalarType<T[P], AggregateUserAccount[P]>
  }




  export type UserAccountGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserAccountWhereInput
    orderBy?: UserAccountOrderByWithAggregationInput | UserAccountOrderByWithAggregationInput[]
    by: UserAccountScalarFieldEnum[] | UserAccountScalarFieldEnum
    having?: UserAccountScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserAccountCountAggregateInputType | true
    _avg?: UserAccountAvgAggregateInputType
    _sum?: UserAccountSumAggregateInputType
    _min?: UserAccountMinAggregateInputType
    _max?: UserAccountMaxAggregateInputType
  }

  export type UserAccountGroupByOutputType = {
    ID: number
    full_name: string
    emailAddress: string
    createdAt: Date
    _count: UserAccountCountAggregateOutputType | null
    _avg: UserAccountAvgAggregateOutputType | null
    _sum: UserAccountSumAggregateOutputType | null
    _min: UserAccountMinAggregateOutputType | null
    _max: UserAccountMaxAggregateOutputType | null
  }

  type GetUserAccountGroupByPayload<T extends UserAccountGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserAccountGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserAccountGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserAccountGroupByOutputType[P]>
            : GetScalarType<T[P], UserAccountGroupByOutputType[P]>
        }
      >
    >


  export type UserAccountSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    ID?: boolean
    full_name?: boolean
    emailAddress?: boolean
    createdAt?: boolean
    orders?: boolean | UserAccount$ordersArgs<ExtArgs>
    _count?: boolean | UserAccountCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["userAccount"]>

  export type UserAccountSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    ID?: boolean
    full_name?: boolean
    emailAddress?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["userAccount"]>

  export type UserAccountSelectScalar = {
    ID?: boolean
    full_name?: boolean
    emailAddress?: boolean
    createdAt?: boolean
  }

  export type UserAccountInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    orders?: boolean | UserAccount$ordersArgs<ExtArgs>
    _count?: boolean | UserAccountCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserAccountIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserAccountPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "UserAccount"
    objects: {
      orders: Prisma.$orderItemPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      ID: number
      full_name: string
      emailAddress: string
      createdAt: Date
    }, ExtArgs["result"]["userAccount"]>
    composites: {}
  }

  type UserAccountGetPayload<S extends boolean | null | undefined | UserAccountDefaultArgs> = $Result.GetResult<Prisma.$UserAccountPayload, S>

  type UserAccountCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<UserAccountFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: UserAccountCountAggregateInputType | true
    }

  export interface UserAccountDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['UserAccount'], meta: { name: 'UserAccount' } }
    /**
     * Find zero or one UserAccount that matches the filter.
     * @param {UserAccountFindUniqueArgs} args - Arguments to find a UserAccount
     * @example
     * // Get one UserAccount
     * const userAccount = await prisma.userAccount.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserAccountFindUniqueArgs>(args: SelectSubset<T, UserAccountFindUniqueArgs<ExtArgs>>): Prisma__UserAccountClient<$Result.GetResult<Prisma.$UserAccountPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one UserAccount that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {UserAccountFindUniqueOrThrowArgs} args - Arguments to find a UserAccount
     * @example
     * // Get one UserAccount
     * const userAccount = await prisma.userAccount.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserAccountFindUniqueOrThrowArgs>(args: SelectSubset<T, UserAccountFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserAccountClient<$Result.GetResult<Prisma.$UserAccountPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first UserAccount that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAccountFindFirstArgs} args - Arguments to find a UserAccount
     * @example
     * // Get one UserAccount
     * const userAccount = await prisma.userAccount.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserAccountFindFirstArgs>(args?: SelectSubset<T, UserAccountFindFirstArgs<ExtArgs>>): Prisma__UserAccountClient<$Result.GetResult<Prisma.$UserAccountPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first UserAccount that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAccountFindFirstOrThrowArgs} args - Arguments to find a UserAccount
     * @example
     * // Get one UserAccount
     * const userAccount = await prisma.userAccount.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserAccountFindFirstOrThrowArgs>(args?: SelectSubset<T, UserAccountFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserAccountClient<$Result.GetResult<Prisma.$UserAccountPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more UserAccounts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAccountFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all UserAccounts
     * const userAccounts = await prisma.userAccount.findMany()
     * 
     * // Get first 10 UserAccounts
     * const userAccounts = await prisma.userAccount.findMany({ take: 10 })
     * 
     * // Only select the `ID`
     * const userAccountWithIDOnly = await prisma.userAccount.findMany({ select: { ID: true } })
     * 
     */
    findMany<T extends UserAccountFindManyArgs>(args?: SelectSubset<T, UserAccountFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserAccountPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a UserAccount.
     * @param {UserAccountCreateArgs} args - Arguments to create a UserAccount.
     * @example
     * // Create one UserAccount
     * const UserAccount = await prisma.userAccount.create({
     *   data: {
     *     // ... data to create a UserAccount
     *   }
     * })
     * 
     */
    create<T extends UserAccountCreateArgs>(args: SelectSubset<T, UserAccountCreateArgs<ExtArgs>>): Prisma__UserAccountClient<$Result.GetResult<Prisma.$UserAccountPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many UserAccounts.
     * @param {UserAccountCreateManyArgs} args - Arguments to create many UserAccounts.
     * @example
     * // Create many UserAccounts
     * const userAccount = await prisma.userAccount.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserAccountCreateManyArgs>(args?: SelectSubset<T, UserAccountCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many UserAccounts and returns the data saved in the database.
     * @param {UserAccountCreateManyAndReturnArgs} args - Arguments to create many UserAccounts.
     * @example
     * // Create many UserAccounts
     * const userAccount = await prisma.userAccount.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many UserAccounts and only return the `ID`
     * const userAccountWithIDOnly = await prisma.userAccount.createManyAndReturn({ 
     *   select: { ID: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserAccountCreateManyAndReturnArgs>(args?: SelectSubset<T, UserAccountCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserAccountPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a UserAccount.
     * @param {UserAccountDeleteArgs} args - Arguments to delete one UserAccount.
     * @example
     * // Delete one UserAccount
     * const UserAccount = await prisma.userAccount.delete({
     *   where: {
     *     // ... filter to delete one UserAccount
     *   }
     * })
     * 
     */
    delete<T extends UserAccountDeleteArgs>(args: SelectSubset<T, UserAccountDeleteArgs<ExtArgs>>): Prisma__UserAccountClient<$Result.GetResult<Prisma.$UserAccountPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one UserAccount.
     * @param {UserAccountUpdateArgs} args - Arguments to update one UserAccount.
     * @example
     * // Update one UserAccount
     * const userAccount = await prisma.userAccount.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserAccountUpdateArgs>(args: SelectSubset<T, UserAccountUpdateArgs<ExtArgs>>): Prisma__UserAccountClient<$Result.GetResult<Prisma.$UserAccountPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more UserAccounts.
     * @param {UserAccountDeleteManyArgs} args - Arguments to filter UserAccounts to delete.
     * @example
     * // Delete a few UserAccounts
     * const { count } = await prisma.userAccount.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserAccountDeleteManyArgs>(args?: SelectSubset<T, UserAccountDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserAccounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAccountUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many UserAccounts
     * const userAccount = await prisma.userAccount.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserAccountUpdateManyArgs>(args: SelectSubset<T, UserAccountUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one UserAccount.
     * @param {UserAccountUpsertArgs} args - Arguments to update or create a UserAccount.
     * @example
     * // Update or create a UserAccount
     * const userAccount = await prisma.userAccount.upsert({
     *   create: {
     *     // ... data to create a UserAccount
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the UserAccount we want to update
     *   }
     * })
     */
    upsert<T extends UserAccountUpsertArgs>(args: SelectSubset<T, UserAccountUpsertArgs<ExtArgs>>): Prisma__UserAccountClient<$Result.GetResult<Prisma.$UserAccountPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of UserAccounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAccountCountArgs} args - Arguments to filter UserAccounts to count.
     * @example
     * // Count the number of UserAccounts
     * const count = await prisma.userAccount.count({
     *   where: {
     *     // ... the filter for the UserAccounts we want to count
     *   }
     * })
    **/
    count<T extends UserAccountCountArgs>(
      args?: Subset<T, UserAccountCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserAccountCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a UserAccount.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAccountAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAccountAggregateArgs>(args: Subset<T, UserAccountAggregateArgs>): Prisma.PrismaPromise<GetUserAccountAggregateType<T>>

    /**
     * Group by UserAccount.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAccountGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserAccountGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserAccountGroupByArgs['orderBy'] }
        : { orderBy?: UserAccountGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserAccountGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserAccountGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the UserAccount model
   */
  readonly fields: UserAccountFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for UserAccount.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserAccountClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    orders<T extends UserAccount$ordersArgs<ExtArgs> = {}>(args?: Subset<T, UserAccount$ordersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$orderItemPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the UserAccount model
   */ 
  interface UserAccountFieldRefs {
    readonly ID: FieldRef<"UserAccount", 'Int'>
    readonly full_name: FieldRef<"UserAccount", 'String'>
    readonly emailAddress: FieldRef<"UserAccount", 'String'>
    readonly createdAt: FieldRef<"UserAccount", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * UserAccount findUnique
   */
  export type UserAccountFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAccount
     */
    select?: UserAccountSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAccountInclude<ExtArgs> | null
    /**
     * Filter, which UserAccount to fetch.
     */
    where: UserAccountWhereUniqueInput
  }

  /**
   * UserAccount findUniqueOrThrow
   */
  export type UserAccountFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAccount
     */
    select?: UserAccountSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAccountInclude<ExtArgs> | null
    /**
     * Filter, which UserAccount to fetch.
     */
    where: UserAccountWhereUniqueInput
  }

  /**
   * UserAccount findFirst
   */
  export type UserAccountFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAccount
     */
    select?: UserAccountSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAccountInclude<ExtArgs> | null
    /**
     * Filter, which UserAccount to fetch.
     */
    where?: UserAccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserAccounts to fetch.
     */
    orderBy?: UserAccountOrderByWithRelationInput | UserAccountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserAccounts.
     */
    cursor?: UserAccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserAccounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserAccounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserAccounts.
     */
    distinct?: UserAccountScalarFieldEnum | UserAccountScalarFieldEnum[]
  }

  /**
   * UserAccount findFirstOrThrow
   */
  export type UserAccountFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAccount
     */
    select?: UserAccountSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAccountInclude<ExtArgs> | null
    /**
     * Filter, which UserAccount to fetch.
     */
    where?: UserAccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserAccounts to fetch.
     */
    orderBy?: UserAccountOrderByWithRelationInput | UserAccountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserAccounts.
     */
    cursor?: UserAccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserAccounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserAccounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserAccounts.
     */
    distinct?: UserAccountScalarFieldEnum | UserAccountScalarFieldEnum[]
  }

  /**
   * UserAccount findMany
   */
  export type UserAccountFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAccount
     */
    select?: UserAccountSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAccountInclude<ExtArgs> | null
    /**
     * Filter, which UserAccounts to fetch.
     */
    where?: UserAccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserAccounts to fetch.
     */
    orderBy?: UserAccountOrderByWithRelationInput | UserAccountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing UserAccounts.
     */
    cursor?: UserAccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserAccounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserAccounts.
     */
    skip?: number
    distinct?: UserAccountScalarFieldEnum | UserAccountScalarFieldEnum[]
  }

  /**
   * UserAccount create
   */
  export type UserAccountCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAccount
     */
    select?: UserAccountSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAccountInclude<ExtArgs> | null
    /**
     * The data needed to create a UserAccount.
     */
    data: XOR<UserAccountCreateInput, UserAccountUncheckedCreateInput>
  }

  /**
   * UserAccount createMany
   */
  export type UserAccountCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many UserAccounts.
     */
    data: UserAccountCreateManyInput | UserAccountCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UserAccount createManyAndReturn
   */
  export type UserAccountCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAccount
     */
    select?: UserAccountSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many UserAccounts.
     */
    data: UserAccountCreateManyInput | UserAccountCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UserAccount update
   */
  export type UserAccountUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAccount
     */
    select?: UserAccountSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAccountInclude<ExtArgs> | null
    /**
     * The data needed to update a UserAccount.
     */
    data: XOR<UserAccountUpdateInput, UserAccountUncheckedUpdateInput>
    /**
     * Choose, which UserAccount to update.
     */
    where: UserAccountWhereUniqueInput
  }

  /**
   * UserAccount updateMany
   */
  export type UserAccountUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update UserAccounts.
     */
    data: XOR<UserAccountUpdateManyMutationInput, UserAccountUncheckedUpdateManyInput>
    /**
     * Filter which UserAccounts to update
     */
    where?: UserAccountWhereInput
  }

  /**
   * UserAccount upsert
   */
  export type UserAccountUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAccount
     */
    select?: UserAccountSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAccountInclude<ExtArgs> | null
    /**
     * The filter to search for the UserAccount to update in case it exists.
     */
    where: UserAccountWhereUniqueInput
    /**
     * In case the UserAccount found by the `where` argument doesn't exist, create a new UserAccount with this data.
     */
    create: XOR<UserAccountCreateInput, UserAccountUncheckedCreateInput>
    /**
     * In case the UserAccount was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserAccountUpdateInput, UserAccountUncheckedUpdateInput>
  }

  /**
   * UserAccount delete
   */
  export type UserAccountDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAccount
     */
    select?: UserAccountSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAccountInclude<ExtArgs> | null
    /**
     * Filter which UserAccount to delete.
     */
    where: UserAccountWhereUniqueInput
  }

  /**
   * UserAccount deleteMany
   */
  export type UserAccountDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserAccounts to delete
     */
    where?: UserAccountWhereInput
  }

  /**
   * UserAccount.orders
   */
  export type UserAccount$ordersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the orderItem
     */
    select?: orderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: orderItemInclude<ExtArgs> | null
    where?: orderItemWhereInput
    orderBy?: orderItemOrderByWithRelationInput | orderItemOrderByWithRelationInput[]
    cursor?: orderItemWhereUniqueInput
    take?: number
    skip?: number
    distinct?: OrderItemScalarFieldEnum | OrderItemScalarFieldEnum[]
  }

  /**
   * UserAccount without action
   */
  export type UserAccountDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserAccount
     */
    select?: UserAccountSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserAccountInclude<ExtArgs> | null
  }


  /**
   * Model orderItem
   */

  export type AggregateOrderItem = {
    _count: OrderItemCountAggregateOutputType | null
    _avg: OrderItemAvgAggregateOutputType | null
    _sum: OrderItemSumAggregateOutputType | null
    _min: OrderItemMinAggregateOutputType | null
    _max: OrderItemMaxAggregateOutputType | null
  }

  export type OrderItemAvgAggregateOutputType = {
    id: number | null
    quantity: number | null
    userID: number | null
  }

  export type OrderItemSumAggregateOutputType = {
    id: number | null
    quantity: number | null
    userID: number | null
  }

  export type OrderItemMinAggregateOutputType = {
    id: number | null
    ProductName: string | null
    quantity: number | null
    userID: number | null
    created_at: Date | null
  }

  export type OrderItemMaxAggregateOutputType = {
    id: number | null
    ProductName: string | null
    quantity: number | null
    userID: number | null
    created_at: Date | null
  }

  export type OrderItemCountAggregateOutputType = {
    id: number
    ProductName: number
    quantity: number
    userID: number
    created_at: number
    _all: number
  }


  export type OrderItemAvgAggregateInputType = {
    id?: true
    quantity?: true
    userID?: true
  }

  export type OrderItemSumAggregateInputType = {
    id?: true
    quantity?: true
    userID?: true
  }

  export type OrderItemMinAggregateInputType = {
    id?: true
    ProductName?: true
    quantity?: true
    userID?: true
    created_at?: true
  }

  export type OrderItemMaxAggregateInputType = {
    id?: true
    ProductName?: true
    quantity?: true
    userID?: true
    created_at?: true
  }

  export type OrderItemCountAggregateInputType = {
    id?: true
    ProductName?: true
    quantity?: true
    userID?: true
    created_at?: true
    _all?: true
  }

  export type OrderItemAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which orderItem to aggregate.
     */
    where?: orderItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of orderItems to fetch.
     */
    orderBy?: orderItemOrderByWithRelationInput | orderItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: orderItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` orderItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` orderItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned orderItems
    **/
    _count?: true | OrderItemCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: OrderItemAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: OrderItemSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: OrderItemMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: OrderItemMaxAggregateInputType
  }

  export type GetOrderItemAggregateType<T extends OrderItemAggregateArgs> = {
        [P in keyof T & keyof AggregateOrderItem]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOrderItem[P]>
      : GetScalarType<T[P], AggregateOrderItem[P]>
  }




  export type orderItemGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: orderItemWhereInput
    orderBy?: orderItemOrderByWithAggregationInput | orderItemOrderByWithAggregationInput[]
    by: OrderItemScalarFieldEnum[] | OrderItemScalarFieldEnum
    having?: orderItemScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: OrderItemCountAggregateInputType | true
    _avg?: OrderItemAvgAggregateInputType
    _sum?: OrderItemSumAggregateInputType
    _min?: OrderItemMinAggregateInputType
    _max?: OrderItemMaxAggregateInputType
  }

  export type OrderItemGroupByOutputType = {
    id: number
    ProductName: string
    quantity: number
    userID: number
    created_at: Date
    _count: OrderItemCountAggregateOutputType | null
    _avg: OrderItemAvgAggregateOutputType | null
    _sum: OrderItemSumAggregateOutputType | null
    _min: OrderItemMinAggregateOutputType | null
    _max: OrderItemMaxAggregateOutputType | null
  }

  type GetOrderItemGroupByPayload<T extends orderItemGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<OrderItemGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof OrderItemGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], OrderItemGroupByOutputType[P]>
            : GetScalarType<T[P], OrderItemGroupByOutputType[P]>
        }
      >
    >


  export type orderItemSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    ProductName?: boolean
    quantity?: boolean
    userID?: boolean
    created_at?: boolean
    userAccount?: boolean | UserAccountDefaultArgs<ExtArgs>
    INVOICE_RECORDS?: boolean | orderItem$INVOICE_RECORDSArgs<ExtArgs>
    _count?: boolean | OrderItemCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["orderItem"]>

  export type orderItemSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    ProductName?: boolean
    quantity?: boolean
    userID?: boolean
    created_at?: boolean
    userAccount?: boolean | UserAccountDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["orderItem"]>

  export type orderItemSelectScalar = {
    id?: boolean
    ProductName?: boolean
    quantity?: boolean
    userID?: boolean
    created_at?: boolean
  }

  export type orderItemInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    userAccount?: boolean | UserAccountDefaultArgs<ExtArgs>
    INVOICE_RECORDS?: boolean | orderItem$INVOICE_RECORDSArgs<ExtArgs>
    _count?: boolean | OrderItemCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type orderItemIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    userAccount?: boolean | UserAccountDefaultArgs<ExtArgs>
  }

  export type $orderItemPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "orderItem"
    objects: {
      userAccount: Prisma.$UserAccountPayload<ExtArgs>
      INVOICE_RECORDS: Prisma.$INVOICE_RECORDSPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      ProductName: string
      quantity: number
      userID: number
      created_at: Date
    }, ExtArgs["result"]["orderItem"]>
    composites: {}
  }

  type orderItemGetPayload<S extends boolean | null | undefined | orderItemDefaultArgs> = $Result.GetResult<Prisma.$orderItemPayload, S>

  type orderItemCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<orderItemFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: OrderItemCountAggregateInputType | true
    }

  export interface orderItemDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['orderItem'], meta: { name: 'orderItem' } }
    /**
     * Find zero or one OrderItem that matches the filter.
     * @param {orderItemFindUniqueArgs} args - Arguments to find a OrderItem
     * @example
     * // Get one OrderItem
     * const orderItem = await prisma.orderItem.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends orderItemFindUniqueArgs>(args: SelectSubset<T, orderItemFindUniqueArgs<ExtArgs>>): Prisma__orderItemClient<$Result.GetResult<Prisma.$orderItemPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one OrderItem that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {orderItemFindUniqueOrThrowArgs} args - Arguments to find a OrderItem
     * @example
     * // Get one OrderItem
     * const orderItem = await prisma.orderItem.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends orderItemFindUniqueOrThrowArgs>(args: SelectSubset<T, orderItemFindUniqueOrThrowArgs<ExtArgs>>): Prisma__orderItemClient<$Result.GetResult<Prisma.$orderItemPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first OrderItem that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {orderItemFindFirstArgs} args - Arguments to find a OrderItem
     * @example
     * // Get one OrderItem
     * const orderItem = await prisma.orderItem.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends orderItemFindFirstArgs>(args?: SelectSubset<T, orderItemFindFirstArgs<ExtArgs>>): Prisma__orderItemClient<$Result.GetResult<Prisma.$orderItemPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first OrderItem that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {orderItemFindFirstOrThrowArgs} args - Arguments to find a OrderItem
     * @example
     * // Get one OrderItem
     * const orderItem = await prisma.orderItem.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends orderItemFindFirstOrThrowArgs>(args?: SelectSubset<T, orderItemFindFirstOrThrowArgs<ExtArgs>>): Prisma__orderItemClient<$Result.GetResult<Prisma.$orderItemPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more OrderItems that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {orderItemFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all OrderItems
     * const orderItems = await prisma.orderItem.findMany()
     * 
     * // Get first 10 OrderItems
     * const orderItems = await prisma.orderItem.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const orderItemWithIdOnly = await prisma.orderItem.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends orderItemFindManyArgs>(args?: SelectSubset<T, orderItemFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$orderItemPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a OrderItem.
     * @param {orderItemCreateArgs} args - Arguments to create a OrderItem.
     * @example
     * // Create one OrderItem
     * const OrderItem = await prisma.orderItem.create({
     *   data: {
     *     // ... data to create a OrderItem
     *   }
     * })
     * 
     */
    create<T extends orderItemCreateArgs>(args: SelectSubset<T, orderItemCreateArgs<ExtArgs>>): Prisma__orderItemClient<$Result.GetResult<Prisma.$orderItemPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many OrderItems.
     * @param {orderItemCreateManyArgs} args - Arguments to create many OrderItems.
     * @example
     * // Create many OrderItems
     * const orderItem = await prisma.orderItem.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends orderItemCreateManyArgs>(args?: SelectSubset<T, orderItemCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many OrderItems and returns the data saved in the database.
     * @param {orderItemCreateManyAndReturnArgs} args - Arguments to create many OrderItems.
     * @example
     * // Create many OrderItems
     * const orderItem = await prisma.orderItem.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many OrderItems and only return the `id`
     * const orderItemWithIdOnly = await prisma.orderItem.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends orderItemCreateManyAndReturnArgs>(args?: SelectSubset<T, orderItemCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$orderItemPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a OrderItem.
     * @param {orderItemDeleteArgs} args - Arguments to delete one OrderItem.
     * @example
     * // Delete one OrderItem
     * const OrderItem = await prisma.orderItem.delete({
     *   where: {
     *     // ... filter to delete one OrderItem
     *   }
     * })
     * 
     */
    delete<T extends orderItemDeleteArgs>(args: SelectSubset<T, orderItemDeleteArgs<ExtArgs>>): Prisma__orderItemClient<$Result.GetResult<Prisma.$orderItemPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one OrderItem.
     * @param {orderItemUpdateArgs} args - Arguments to update one OrderItem.
     * @example
     * // Update one OrderItem
     * const orderItem = await prisma.orderItem.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends orderItemUpdateArgs>(args: SelectSubset<T, orderItemUpdateArgs<ExtArgs>>): Prisma__orderItemClient<$Result.GetResult<Prisma.$orderItemPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more OrderItems.
     * @param {orderItemDeleteManyArgs} args - Arguments to filter OrderItems to delete.
     * @example
     * // Delete a few OrderItems
     * const { count } = await prisma.orderItem.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends orderItemDeleteManyArgs>(args?: SelectSubset<T, orderItemDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more OrderItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {orderItemUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many OrderItems
     * const orderItem = await prisma.orderItem.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends orderItemUpdateManyArgs>(args: SelectSubset<T, orderItemUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one OrderItem.
     * @param {orderItemUpsertArgs} args - Arguments to update or create a OrderItem.
     * @example
     * // Update or create a OrderItem
     * const orderItem = await prisma.orderItem.upsert({
     *   create: {
     *     // ... data to create a OrderItem
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the OrderItem we want to update
     *   }
     * })
     */
    upsert<T extends orderItemUpsertArgs>(args: SelectSubset<T, orderItemUpsertArgs<ExtArgs>>): Prisma__orderItemClient<$Result.GetResult<Prisma.$orderItemPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of OrderItems.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {orderItemCountArgs} args - Arguments to filter OrderItems to count.
     * @example
     * // Count the number of OrderItems
     * const count = await prisma.orderItem.count({
     *   where: {
     *     // ... the filter for the OrderItems we want to count
     *   }
     * })
    **/
    count<T extends orderItemCountArgs>(
      args?: Subset<T, orderItemCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], OrderItemCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a OrderItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OrderItemAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends OrderItemAggregateArgs>(args: Subset<T, OrderItemAggregateArgs>): Prisma.PrismaPromise<GetOrderItemAggregateType<T>>

    /**
     * Group by OrderItem.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {orderItemGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends orderItemGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: orderItemGroupByArgs['orderBy'] }
        : { orderBy?: orderItemGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, orderItemGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetOrderItemGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the orderItem model
   */
  readonly fields: orderItemFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for orderItem.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__orderItemClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    userAccount<T extends UserAccountDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserAccountDefaultArgs<ExtArgs>>): Prisma__UserAccountClient<$Result.GetResult<Prisma.$UserAccountPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    INVOICE_RECORDS<T extends orderItem$INVOICE_RECORDSArgs<ExtArgs> = {}>(args?: Subset<T, orderItem$INVOICE_RECORDSArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$INVOICE_RECORDSPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the orderItem model
   */ 
  interface orderItemFieldRefs {
    readonly id: FieldRef<"orderItem", 'Int'>
    readonly ProductName: FieldRef<"orderItem", 'String'>
    readonly quantity: FieldRef<"orderItem", 'Int'>
    readonly userID: FieldRef<"orderItem", 'Int'>
    readonly created_at: FieldRef<"orderItem", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * orderItem findUnique
   */
  export type orderItemFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the orderItem
     */
    select?: orderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: orderItemInclude<ExtArgs> | null
    /**
     * Filter, which orderItem to fetch.
     */
    where: orderItemWhereUniqueInput
  }

  /**
   * orderItem findUniqueOrThrow
   */
  export type orderItemFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the orderItem
     */
    select?: orderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: orderItemInclude<ExtArgs> | null
    /**
     * Filter, which orderItem to fetch.
     */
    where: orderItemWhereUniqueInput
  }

  /**
   * orderItem findFirst
   */
  export type orderItemFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the orderItem
     */
    select?: orderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: orderItemInclude<ExtArgs> | null
    /**
     * Filter, which orderItem to fetch.
     */
    where?: orderItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of orderItems to fetch.
     */
    orderBy?: orderItemOrderByWithRelationInput | orderItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for orderItems.
     */
    cursor?: orderItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` orderItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` orderItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of orderItems.
     */
    distinct?: OrderItemScalarFieldEnum | OrderItemScalarFieldEnum[]
  }

  /**
   * orderItem findFirstOrThrow
   */
  export type orderItemFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the orderItem
     */
    select?: orderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: orderItemInclude<ExtArgs> | null
    /**
     * Filter, which orderItem to fetch.
     */
    where?: orderItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of orderItems to fetch.
     */
    orderBy?: orderItemOrderByWithRelationInput | orderItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for orderItems.
     */
    cursor?: orderItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` orderItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` orderItems.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of orderItems.
     */
    distinct?: OrderItemScalarFieldEnum | OrderItemScalarFieldEnum[]
  }

  /**
   * orderItem findMany
   */
  export type orderItemFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the orderItem
     */
    select?: orderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: orderItemInclude<ExtArgs> | null
    /**
     * Filter, which orderItems to fetch.
     */
    where?: orderItemWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of orderItems to fetch.
     */
    orderBy?: orderItemOrderByWithRelationInput | orderItemOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing orderItems.
     */
    cursor?: orderItemWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` orderItems from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` orderItems.
     */
    skip?: number
    distinct?: OrderItemScalarFieldEnum | OrderItemScalarFieldEnum[]
  }

  /**
   * orderItem create
   */
  export type orderItemCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the orderItem
     */
    select?: orderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: orderItemInclude<ExtArgs> | null
    /**
     * The data needed to create a orderItem.
     */
    data: XOR<orderItemCreateInput, orderItemUncheckedCreateInput>
  }

  /**
   * orderItem createMany
   */
  export type orderItemCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many orderItems.
     */
    data: orderItemCreateManyInput | orderItemCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * orderItem createManyAndReturn
   */
  export type orderItemCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the orderItem
     */
    select?: orderItemSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many orderItems.
     */
    data: orderItemCreateManyInput | orderItemCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: orderItemIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * orderItem update
   */
  export type orderItemUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the orderItem
     */
    select?: orderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: orderItemInclude<ExtArgs> | null
    /**
     * The data needed to update a orderItem.
     */
    data: XOR<orderItemUpdateInput, orderItemUncheckedUpdateInput>
    /**
     * Choose, which orderItem to update.
     */
    where: orderItemWhereUniqueInput
  }

  /**
   * orderItem updateMany
   */
  export type orderItemUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update orderItems.
     */
    data: XOR<orderItemUpdateManyMutationInput, orderItemUncheckedUpdateManyInput>
    /**
     * Filter which orderItems to update
     */
    where?: orderItemWhereInput
  }

  /**
   * orderItem upsert
   */
  export type orderItemUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the orderItem
     */
    select?: orderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: orderItemInclude<ExtArgs> | null
    /**
     * The filter to search for the orderItem to update in case it exists.
     */
    where: orderItemWhereUniqueInput
    /**
     * In case the orderItem found by the `where` argument doesn't exist, create a new orderItem with this data.
     */
    create: XOR<orderItemCreateInput, orderItemUncheckedCreateInput>
    /**
     * In case the orderItem was found with the provided `where` argument, update it with this data.
     */
    update: XOR<orderItemUpdateInput, orderItemUncheckedUpdateInput>
  }

  /**
   * orderItem delete
   */
  export type orderItemDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the orderItem
     */
    select?: orderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: orderItemInclude<ExtArgs> | null
    /**
     * Filter which orderItem to delete.
     */
    where: orderItemWhereUniqueInput
  }

  /**
   * orderItem deleteMany
   */
  export type orderItemDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which orderItems to delete
     */
    where?: orderItemWhereInput
  }

  /**
   * orderItem.INVOICE_RECORDS
   */
  export type orderItem$INVOICE_RECORDSArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the INVOICE_RECORDS
     */
    select?: INVOICE_RECORDSSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: INVOICE_RECORDSInclude<ExtArgs> | null
    where?: INVOICE_RECORDSWhereInput
    orderBy?: INVOICE_RECORDSOrderByWithRelationInput | INVOICE_RECORDSOrderByWithRelationInput[]
    cursor?: INVOICE_RECORDSWhereUniqueInput
    take?: number
    skip?: number
    distinct?: INVOICE_RECORDSScalarFieldEnum | INVOICE_RECORDSScalarFieldEnum[]
  }

  /**
   * orderItem without action
   */
  export type orderItemDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the orderItem
     */
    select?: orderItemSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: orderItemInclude<ExtArgs> | null
  }


  /**
   * Model PRODUCT_CATALOG
   */

  export type AggregatePRODUCT_CATALOG = {
    _count: PRODUCT_CATALOGCountAggregateOutputType | null
    _avg: PRODUCT_CATALOGAvgAggregateOutputType | null
    _sum: PRODUCT_CATALOGSumAggregateOutputType | null
    _min: PRODUCT_CATALOGMinAggregateOutputType | null
    _max: PRODUCT_CATALOGMaxAggregateOutputType | null
  }

  export type PRODUCT_CATALOGAvgAggregateOutputType = {
    product_id: number | null
    price: number | null
  }

  export type PRODUCT_CATALOGSumAggregateOutputType = {
    product_id: number | null
    price: number | null
  }

  export type PRODUCT_CATALOGMinAggregateOutputType = {
    product_id: number | null
    productname: string | null
    price: number | null
    category: $Enums.productCategory | null
  }

  export type PRODUCT_CATALOGMaxAggregateOutputType = {
    product_id: number | null
    productname: string | null
    price: number | null
    category: $Enums.productCategory | null
  }

  export type PRODUCT_CATALOGCountAggregateOutputType = {
    product_id: number
    productname: number
    price: number
    category: number
    _all: number
  }


  export type PRODUCT_CATALOGAvgAggregateInputType = {
    product_id?: true
    price?: true
  }

  export type PRODUCT_CATALOGSumAggregateInputType = {
    product_id?: true
    price?: true
  }

  export type PRODUCT_CATALOGMinAggregateInputType = {
    product_id?: true
    productname?: true
    price?: true
    category?: true
  }

  export type PRODUCT_CATALOGMaxAggregateInputType = {
    product_id?: true
    productname?: true
    price?: true
    category?: true
  }

  export type PRODUCT_CATALOGCountAggregateInputType = {
    product_id?: true
    productname?: true
    price?: true
    category?: true
    _all?: true
  }

  export type PRODUCT_CATALOGAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PRODUCT_CATALOG to aggregate.
     */
    where?: PRODUCT_CATALOGWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PRODUCT_CATALOGS to fetch.
     */
    orderBy?: PRODUCT_CATALOGOrderByWithRelationInput | PRODUCT_CATALOGOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PRODUCT_CATALOGWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PRODUCT_CATALOGS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PRODUCT_CATALOGS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PRODUCT_CATALOGS
    **/
    _count?: true | PRODUCT_CATALOGCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PRODUCT_CATALOGAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PRODUCT_CATALOGSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PRODUCT_CATALOGMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PRODUCT_CATALOGMaxAggregateInputType
  }

  export type GetPRODUCT_CATALOGAggregateType<T extends PRODUCT_CATALOGAggregateArgs> = {
        [P in keyof T & keyof AggregatePRODUCT_CATALOG]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePRODUCT_CATALOG[P]>
      : GetScalarType<T[P], AggregatePRODUCT_CATALOG[P]>
  }




  export type PRODUCT_CATALOGGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PRODUCT_CATALOGWhereInput
    orderBy?: PRODUCT_CATALOGOrderByWithAggregationInput | PRODUCT_CATALOGOrderByWithAggregationInput[]
    by: PRODUCT_CATALOGScalarFieldEnum[] | PRODUCT_CATALOGScalarFieldEnum
    having?: PRODUCT_CATALOGScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PRODUCT_CATALOGCountAggregateInputType | true
    _avg?: PRODUCT_CATALOGAvgAggregateInputType
    _sum?: PRODUCT_CATALOGSumAggregateInputType
    _min?: PRODUCT_CATALOGMinAggregateInputType
    _max?: PRODUCT_CATALOGMaxAggregateInputType
  }

  export type PRODUCT_CATALOGGroupByOutputType = {
    product_id: number
    productname: string
    price: number
    category: $Enums.productCategory
    _count: PRODUCT_CATALOGCountAggregateOutputType | null
    _avg: PRODUCT_CATALOGAvgAggregateOutputType | null
    _sum: PRODUCT_CATALOGSumAggregateOutputType | null
    _min: PRODUCT_CATALOGMinAggregateOutputType | null
    _max: PRODUCT_CATALOGMaxAggregateOutputType | null
  }

  type GetPRODUCT_CATALOGGroupByPayload<T extends PRODUCT_CATALOGGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PRODUCT_CATALOGGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PRODUCT_CATALOGGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PRODUCT_CATALOGGroupByOutputType[P]>
            : GetScalarType<T[P], PRODUCT_CATALOGGroupByOutputType[P]>
        }
      >
    >


  export type PRODUCT_CATALOGSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    product_id?: boolean
    productname?: boolean
    price?: boolean
    category?: boolean
  }, ExtArgs["result"]["pRODUCT_CATALOG"]>

  export type PRODUCT_CATALOGSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    product_id?: boolean
    productname?: boolean
    price?: boolean
    category?: boolean
  }, ExtArgs["result"]["pRODUCT_CATALOG"]>

  export type PRODUCT_CATALOGSelectScalar = {
    product_id?: boolean
    productname?: boolean
    price?: boolean
    category?: boolean
  }


  export type $PRODUCT_CATALOGPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PRODUCT_CATALOG"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      product_id: number
      productname: string
      price: number
      category: $Enums.productCategory
    }, ExtArgs["result"]["pRODUCT_CATALOG"]>
    composites: {}
  }

  type PRODUCT_CATALOGGetPayload<S extends boolean | null | undefined | PRODUCT_CATALOGDefaultArgs> = $Result.GetResult<Prisma.$PRODUCT_CATALOGPayload, S>

  type PRODUCT_CATALOGCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<PRODUCT_CATALOGFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: PRODUCT_CATALOGCountAggregateInputType | true
    }

  export interface PRODUCT_CATALOGDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PRODUCT_CATALOG'], meta: { name: 'PRODUCT_CATALOG' } }
    /**
     * Find zero or one PRODUCT_CATALOG that matches the filter.
     * @param {PRODUCT_CATALOGFindUniqueArgs} args - Arguments to find a PRODUCT_CATALOG
     * @example
     * // Get one PRODUCT_CATALOG
     * const pRODUCT_CATALOG = await prisma.pRODUCT_CATALOG.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PRODUCT_CATALOGFindUniqueArgs>(args: SelectSubset<T, PRODUCT_CATALOGFindUniqueArgs<ExtArgs>>): Prisma__PRODUCT_CATALOGClient<$Result.GetResult<Prisma.$PRODUCT_CATALOGPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one PRODUCT_CATALOG that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {PRODUCT_CATALOGFindUniqueOrThrowArgs} args - Arguments to find a PRODUCT_CATALOG
     * @example
     * // Get one PRODUCT_CATALOG
     * const pRODUCT_CATALOG = await prisma.pRODUCT_CATALOG.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PRODUCT_CATALOGFindUniqueOrThrowArgs>(args: SelectSubset<T, PRODUCT_CATALOGFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PRODUCT_CATALOGClient<$Result.GetResult<Prisma.$PRODUCT_CATALOGPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first PRODUCT_CATALOG that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PRODUCT_CATALOGFindFirstArgs} args - Arguments to find a PRODUCT_CATALOG
     * @example
     * // Get one PRODUCT_CATALOG
     * const pRODUCT_CATALOG = await prisma.pRODUCT_CATALOG.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PRODUCT_CATALOGFindFirstArgs>(args?: SelectSubset<T, PRODUCT_CATALOGFindFirstArgs<ExtArgs>>): Prisma__PRODUCT_CATALOGClient<$Result.GetResult<Prisma.$PRODUCT_CATALOGPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first PRODUCT_CATALOG that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PRODUCT_CATALOGFindFirstOrThrowArgs} args - Arguments to find a PRODUCT_CATALOG
     * @example
     * // Get one PRODUCT_CATALOG
     * const pRODUCT_CATALOG = await prisma.pRODUCT_CATALOG.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PRODUCT_CATALOGFindFirstOrThrowArgs>(args?: SelectSubset<T, PRODUCT_CATALOGFindFirstOrThrowArgs<ExtArgs>>): Prisma__PRODUCT_CATALOGClient<$Result.GetResult<Prisma.$PRODUCT_CATALOGPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more PRODUCT_CATALOGS that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PRODUCT_CATALOGFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PRODUCT_CATALOGS
     * const pRODUCT_CATALOGS = await prisma.pRODUCT_CATALOG.findMany()
     * 
     * // Get first 10 PRODUCT_CATALOGS
     * const pRODUCT_CATALOGS = await prisma.pRODUCT_CATALOG.findMany({ take: 10 })
     * 
     * // Only select the `product_id`
     * const pRODUCT_CATALOGWithProduct_idOnly = await prisma.pRODUCT_CATALOG.findMany({ select: { product_id: true } })
     * 
     */
    findMany<T extends PRODUCT_CATALOGFindManyArgs>(args?: SelectSubset<T, PRODUCT_CATALOGFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PRODUCT_CATALOGPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a PRODUCT_CATALOG.
     * @param {PRODUCT_CATALOGCreateArgs} args - Arguments to create a PRODUCT_CATALOG.
     * @example
     * // Create one PRODUCT_CATALOG
     * const PRODUCT_CATALOG = await prisma.pRODUCT_CATALOG.create({
     *   data: {
     *     // ... data to create a PRODUCT_CATALOG
     *   }
     * })
     * 
     */
    create<T extends PRODUCT_CATALOGCreateArgs>(args: SelectSubset<T, PRODUCT_CATALOGCreateArgs<ExtArgs>>): Prisma__PRODUCT_CATALOGClient<$Result.GetResult<Prisma.$PRODUCT_CATALOGPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many PRODUCT_CATALOGS.
     * @param {PRODUCT_CATALOGCreateManyArgs} args - Arguments to create many PRODUCT_CATALOGS.
     * @example
     * // Create many PRODUCT_CATALOGS
     * const pRODUCT_CATALOG = await prisma.pRODUCT_CATALOG.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PRODUCT_CATALOGCreateManyArgs>(args?: SelectSubset<T, PRODUCT_CATALOGCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PRODUCT_CATALOGS and returns the data saved in the database.
     * @param {PRODUCT_CATALOGCreateManyAndReturnArgs} args - Arguments to create many PRODUCT_CATALOGS.
     * @example
     * // Create many PRODUCT_CATALOGS
     * const pRODUCT_CATALOG = await prisma.pRODUCT_CATALOG.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PRODUCT_CATALOGS and only return the `product_id`
     * const pRODUCT_CATALOGWithProduct_idOnly = await prisma.pRODUCT_CATALOG.createManyAndReturn({ 
     *   select: { product_id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PRODUCT_CATALOGCreateManyAndReturnArgs>(args?: SelectSubset<T, PRODUCT_CATALOGCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PRODUCT_CATALOGPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a PRODUCT_CATALOG.
     * @param {PRODUCT_CATALOGDeleteArgs} args - Arguments to delete one PRODUCT_CATALOG.
     * @example
     * // Delete one PRODUCT_CATALOG
     * const PRODUCT_CATALOG = await prisma.pRODUCT_CATALOG.delete({
     *   where: {
     *     // ... filter to delete one PRODUCT_CATALOG
     *   }
     * })
     * 
     */
    delete<T extends PRODUCT_CATALOGDeleteArgs>(args: SelectSubset<T, PRODUCT_CATALOGDeleteArgs<ExtArgs>>): Prisma__PRODUCT_CATALOGClient<$Result.GetResult<Prisma.$PRODUCT_CATALOGPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one PRODUCT_CATALOG.
     * @param {PRODUCT_CATALOGUpdateArgs} args - Arguments to update one PRODUCT_CATALOG.
     * @example
     * // Update one PRODUCT_CATALOG
     * const pRODUCT_CATALOG = await prisma.pRODUCT_CATALOG.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PRODUCT_CATALOGUpdateArgs>(args: SelectSubset<T, PRODUCT_CATALOGUpdateArgs<ExtArgs>>): Prisma__PRODUCT_CATALOGClient<$Result.GetResult<Prisma.$PRODUCT_CATALOGPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more PRODUCT_CATALOGS.
     * @param {PRODUCT_CATALOGDeleteManyArgs} args - Arguments to filter PRODUCT_CATALOGS to delete.
     * @example
     * // Delete a few PRODUCT_CATALOGS
     * const { count } = await prisma.pRODUCT_CATALOG.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PRODUCT_CATALOGDeleteManyArgs>(args?: SelectSubset<T, PRODUCT_CATALOGDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PRODUCT_CATALOGS.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PRODUCT_CATALOGUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PRODUCT_CATALOGS
     * const pRODUCT_CATALOG = await prisma.pRODUCT_CATALOG.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PRODUCT_CATALOGUpdateManyArgs>(args: SelectSubset<T, PRODUCT_CATALOGUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one PRODUCT_CATALOG.
     * @param {PRODUCT_CATALOGUpsertArgs} args - Arguments to update or create a PRODUCT_CATALOG.
     * @example
     * // Update or create a PRODUCT_CATALOG
     * const pRODUCT_CATALOG = await prisma.pRODUCT_CATALOG.upsert({
     *   create: {
     *     // ... data to create a PRODUCT_CATALOG
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PRODUCT_CATALOG we want to update
     *   }
     * })
     */
    upsert<T extends PRODUCT_CATALOGUpsertArgs>(args: SelectSubset<T, PRODUCT_CATALOGUpsertArgs<ExtArgs>>): Prisma__PRODUCT_CATALOGClient<$Result.GetResult<Prisma.$PRODUCT_CATALOGPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of PRODUCT_CATALOGS.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PRODUCT_CATALOGCountArgs} args - Arguments to filter PRODUCT_CATALOGS to count.
     * @example
     * // Count the number of PRODUCT_CATALOGS
     * const count = await prisma.pRODUCT_CATALOG.count({
     *   where: {
     *     // ... the filter for the PRODUCT_CATALOGS we want to count
     *   }
     * })
    **/
    count<T extends PRODUCT_CATALOGCountArgs>(
      args?: Subset<T, PRODUCT_CATALOGCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PRODUCT_CATALOGCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PRODUCT_CATALOG.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PRODUCT_CATALOGAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PRODUCT_CATALOGAggregateArgs>(args: Subset<T, PRODUCT_CATALOGAggregateArgs>): Prisma.PrismaPromise<GetPRODUCT_CATALOGAggregateType<T>>

    /**
     * Group by PRODUCT_CATALOG.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PRODUCT_CATALOGGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PRODUCT_CATALOGGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PRODUCT_CATALOGGroupByArgs['orderBy'] }
        : { orderBy?: PRODUCT_CATALOGGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PRODUCT_CATALOGGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPRODUCT_CATALOGGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PRODUCT_CATALOG model
   */
  readonly fields: PRODUCT_CATALOGFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PRODUCT_CATALOG.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PRODUCT_CATALOGClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PRODUCT_CATALOG model
   */ 
  interface PRODUCT_CATALOGFieldRefs {
    readonly product_id: FieldRef<"PRODUCT_CATALOG", 'Int'>
    readonly productname: FieldRef<"PRODUCT_CATALOG", 'String'>
    readonly price: FieldRef<"PRODUCT_CATALOG", 'Float'>
    readonly category: FieldRef<"PRODUCT_CATALOG", 'productCategory'>
  }
    

  // Custom InputTypes
  /**
   * PRODUCT_CATALOG findUnique
   */
  export type PRODUCT_CATALOGFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PRODUCT_CATALOG
     */
    select?: PRODUCT_CATALOGSelect<ExtArgs> | null
    /**
     * Filter, which PRODUCT_CATALOG to fetch.
     */
    where: PRODUCT_CATALOGWhereUniqueInput
  }

  /**
   * PRODUCT_CATALOG findUniqueOrThrow
   */
  export type PRODUCT_CATALOGFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PRODUCT_CATALOG
     */
    select?: PRODUCT_CATALOGSelect<ExtArgs> | null
    /**
     * Filter, which PRODUCT_CATALOG to fetch.
     */
    where: PRODUCT_CATALOGWhereUniqueInput
  }

  /**
   * PRODUCT_CATALOG findFirst
   */
  export type PRODUCT_CATALOGFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PRODUCT_CATALOG
     */
    select?: PRODUCT_CATALOGSelect<ExtArgs> | null
    /**
     * Filter, which PRODUCT_CATALOG to fetch.
     */
    where?: PRODUCT_CATALOGWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PRODUCT_CATALOGS to fetch.
     */
    orderBy?: PRODUCT_CATALOGOrderByWithRelationInput | PRODUCT_CATALOGOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PRODUCT_CATALOGS.
     */
    cursor?: PRODUCT_CATALOGWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PRODUCT_CATALOGS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PRODUCT_CATALOGS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PRODUCT_CATALOGS.
     */
    distinct?: PRODUCT_CATALOGScalarFieldEnum | PRODUCT_CATALOGScalarFieldEnum[]
  }

  /**
   * PRODUCT_CATALOG findFirstOrThrow
   */
  export type PRODUCT_CATALOGFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PRODUCT_CATALOG
     */
    select?: PRODUCT_CATALOGSelect<ExtArgs> | null
    /**
     * Filter, which PRODUCT_CATALOG to fetch.
     */
    where?: PRODUCT_CATALOGWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PRODUCT_CATALOGS to fetch.
     */
    orderBy?: PRODUCT_CATALOGOrderByWithRelationInput | PRODUCT_CATALOGOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PRODUCT_CATALOGS.
     */
    cursor?: PRODUCT_CATALOGWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PRODUCT_CATALOGS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PRODUCT_CATALOGS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PRODUCT_CATALOGS.
     */
    distinct?: PRODUCT_CATALOGScalarFieldEnum | PRODUCT_CATALOGScalarFieldEnum[]
  }

  /**
   * PRODUCT_CATALOG findMany
   */
  export type PRODUCT_CATALOGFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PRODUCT_CATALOG
     */
    select?: PRODUCT_CATALOGSelect<ExtArgs> | null
    /**
     * Filter, which PRODUCT_CATALOGS to fetch.
     */
    where?: PRODUCT_CATALOGWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PRODUCT_CATALOGS to fetch.
     */
    orderBy?: PRODUCT_CATALOGOrderByWithRelationInput | PRODUCT_CATALOGOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PRODUCT_CATALOGS.
     */
    cursor?: PRODUCT_CATALOGWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PRODUCT_CATALOGS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PRODUCT_CATALOGS.
     */
    skip?: number
    distinct?: PRODUCT_CATALOGScalarFieldEnum | PRODUCT_CATALOGScalarFieldEnum[]
  }

  /**
   * PRODUCT_CATALOG create
   */
  export type PRODUCT_CATALOGCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PRODUCT_CATALOG
     */
    select?: PRODUCT_CATALOGSelect<ExtArgs> | null
    /**
     * The data needed to create a PRODUCT_CATALOG.
     */
    data: XOR<PRODUCT_CATALOGCreateInput, PRODUCT_CATALOGUncheckedCreateInput>
  }

  /**
   * PRODUCT_CATALOG createMany
   */
  export type PRODUCT_CATALOGCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PRODUCT_CATALOGS.
     */
    data: PRODUCT_CATALOGCreateManyInput | PRODUCT_CATALOGCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PRODUCT_CATALOG createManyAndReturn
   */
  export type PRODUCT_CATALOGCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PRODUCT_CATALOG
     */
    select?: PRODUCT_CATALOGSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many PRODUCT_CATALOGS.
     */
    data: PRODUCT_CATALOGCreateManyInput | PRODUCT_CATALOGCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PRODUCT_CATALOG update
   */
  export type PRODUCT_CATALOGUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PRODUCT_CATALOG
     */
    select?: PRODUCT_CATALOGSelect<ExtArgs> | null
    /**
     * The data needed to update a PRODUCT_CATALOG.
     */
    data: XOR<PRODUCT_CATALOGUpdateInput, PRODUCT_CATALOGUncheckedUpdateInput>
    /**
     * Choose, which PRODUCT_CATALOG to update.
     */
    where: PRODUCT_CATALOGWhereUniqueInput
  }

  /**
   * PRODUCT_CATALOG updateMany
   */
  export type PRODUCT_CATALOGUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PRODUCT_CATALOGS.
     */
    data: XOR<PRODUCT_CATALOGUpdateManyMutationInput, PRODUCT_CATALOGUncheckedUpdateManyInput>
    /**
     * Filter which PRODUCT_CATALOGS to update
     */
    where?: PRODUCT_CATALOGWhereInput
  }

  /**
   * PRODUCT_CATALOG upsert
   */
  export type PRODUCT_CATALOGUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PRODUCT_CATALOG
     */
    select?: PRODUCT_CATALOGSelect<ExtArgs> | null
    /**
     * The filter to search for the PRODUCT_CATALOG to update in case it exists.
     */
    where: PRODUCT_CATALOGWhereUniqueInput
    /**
     * In case the PRODUCT_CATALOG found by the `where` argument doesn't exist, create a new PRODUCT_CATALOG with this data.
     */
    create: XOR<PRODUCT_CATALOGCreateInput, PRODUCT_CATALOGUncheckedCreateInput>
    /**
     * In case the PRODUCT_CATALOG was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PRODUCT_CATALOGUpdateInput, PRODUCT_CATALOGUncheckedUpdateInput>
  }

  /**
   * PRODUCT_CATALOG delete
   */
  export type PRODUCT_CATALOGDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PRODUCT_CATALOG
     */
    select?: PRODUCT_CATALOGSelect<ExtArgs> | null
    /**
     * Filter which PRODUCT_CATALOG to delete.
     */
    where: PRODUCT_CATALOGWhereUniqueInput
  }

  /**
   * PRODUCT_CATALOG deleteMany
   */
  export type PRODUCT_CATALOGDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PRODUCT_CATALOGS to delete
     */
    where?: PRODUCT_CATALOGWhereInput
  }

  /**
   * PRODUCT_CATALOG without action
   */
  export type PRODUCT_CATALOGDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PRODUCT_CATALOG
     */
    select?: PRODUCT_CATALOGSelect<ExtArgs> | null
  }


  /**
   * Model INVOICE_RECORDS
   */

  export type AggregateINVOICE_RECORDS = {
    _count: INVOICE_RECORDSCountAggregateOutputType | null
    _avg: INVOICE_RECORDSAvgAggregateOutputType | null
    _sum: INVOICE_RECORDSSumAggregateOutputType | null
    _min: INVOICE_RECORDSMinAggregateOutputType | null
    _max: INVOICE_RECORDSMaxAggregateOutputType | null
  }

  export type INVOICE_RECORDSAvgAggregateOutputType = {
    invoiceID: number | null
    ORDER_ID: number | null
    amount: number | null
  }

  export type INVOICE_RECORDSSumAggregateOutputType = {
    invoiceID: number | null
    ORDER_ID: number | null
    amount: number | null
  }

  export type INVOICE_RECORDSMinAggregateOutputType = {
    invoiceID: number | null
    ORDER_ID: number | null
    amount: number | null
    issuedAt: Date | null
  }

  export type INVOICE_RECORDSMaxAggregateOutputType = {
    invoiceID: number | null
    ORDER_ID: number | null
    amount: number | null
    issuedAt: Date | null
  }

  export type INVOICE_RECORDSCountAggregateOutputType = {
    invoiceID: number
    ORDER_ID: number
    amount: number
    issuedAt: number
    _all: number
  }


  export type INVOICE_RECORDSAvgAggregateInputType = {
    invoiceID?: true
    ORDER_ID?: true
    amount?: true
  }

  export type INVOICE_RECORDSSumAggregateInputType = {
    invoiceID?: true
    ORDER_ID?: true
    amount?: true
  }

  export type INVOICE_RECORDSMinAggregateInputType = {
    invoiceID?: true
    ORDER_ID?: true
    amount?: true
    issuedAt?: true
  }

  export type INVOICE_RECORDSMaxAggregateInputType = {
    invoiceID?: true
    ORDER_ID?: true
    amount?: true
    issuedAt?: true
  }

  export type INVOICE_RECORDSCountAggregateInputType = {
    invoiceID?: true
    ORDER_ID?: true
    amount?: true
    issuedAt?: true
    _all?: true
  }

  export type INVOICE_RECORDSAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which INVOICE_RECORDS to aggregate.
     */
    where?: INVOICE_RECORDSWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of INVOICE_RECORDS to fetch.
     */
    orderBy?: INVOICE_RECORDSOrderByWithRelationInput | INVOICE_RECORDSOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: INVOICE_RECORDSWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` INVOICE_RECORDS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` INVOICE_RECORDS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned INVOICE_RECORDS
    **/
    _count?: true | INVOICE_RECORDSCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: INVOICE_RECORDSAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: INVOICE_RECORDSSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: INVOICE_RECORDSMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: INVOICE_RECORDSMaxAggregateInputType
  }

  export type GetINVOICE_RECORDSAggregateType<T extends INVOICE_RECORDSAggregateArgs> = {
        [P in keyof T & keyof AggregateINVOICE_RECORDS]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateINVOICE_RECORDS[P]>
      : GetScalarType<T[P], AggregateINVOICE_RECORDS[P]>
  }




  export type INVOICE_RECORDSGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: INVOICE_RECORDSWhereInput
    orderBy?: INVOICE_RECORDSOrderByWithAggregationInput | INVOICE_RECORDSOrderByWithAggregationInput[]
    by: INVOICE_RECORDSScalarFieldEnum[] | INVOICE_RECORDSScalarFieldEnum
    having?: INVOICE_RECORDSScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: INVOICE_RECORDSCountAggregateInputType | true
    _avg?: INVOICE_RECORDSAvgAggregateInputType
    _sum?: INVOICE_RECORDSSumAggregateInputType
    _min?: INVOICE_RECORDSMinAggregateInputType
    _max?: INVOICE_RECORDSMaxAggregateInputType
  }

  export type INVOICE_RECORDSGroupByOutputType = {
    invoiceID: number
    ORDER_ID: number
    amount: number
    issuedAt: Date
    _count: INVOICE_RECORDSCountAggregateOutputType | null
    _avg: INVOICE_RECORDSAvgAggregateOutputType | null
    _sum: INVOICE_RECORDSSumAggregateOutputType | null
    _min: INVOICE_RECORDSMinAggregateOutputType | null
    _max: INVOICE_RECORDSMaxAggregateOutputType | null
  }

  type GetINVOICE_RECORDSGroupByPayload<T extends INVOICE_RECORDSGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<INVOICE_RECORDSGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof INVOICE_RECORDSGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], INVOICE_RECORDSGroupByOutputType[P]>
            : GetScalarType<T[P], INVOICE_RECORDSGroupByOutputType[P]>
        }
      >
    >


  export type INVOICE_RECORDSSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    invoiceID?: boolean
    ORDER_ID?: boolean
    amount?: boolean
    issuedAt?: boolean
    orderItem?: boolean | orderItemDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["iNVOICE_RECORDS"]>

  export type INVOICE_RECORDSSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    invoiceID?: boolean
    ORDER_ID?: boolean
    amount?: boolean
    issuedAt?: boolean
    orderItem?: boolean | orderItemDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["iNVOICE_RECORDS"]>

  export type INVOICE_RECORDSSelectScalar = {
    invoiceID?: boolean
    ORDER_ID?: boolean
    amount?: boolean
    issuedAt?: boolean
  }

  export type INVOICE_RECORDSInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    orderItem?: boolean | orderItemDefaultArgs<ExtArgs>
  }
  export type INVOICE_RECORDSIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    orderItem?: boolean | orderItemDefaultArgs<ExtArgs>
  }

  export type $INVOICE_RECORDSPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "INVOICE_RECORDS"
    objects: {
      orderItem: Prisma.$orderItemPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      invoiceID: number
      ORDER_ID: number
      amount: number
      issuedAt: Date
    }, ExtArgs["result"]["iNVOICE_RECORDS"]>
    composites: {}
  }

  type INVOICE_RECORDSGetPayload<S extends boolean | null | undefined | INVOICE_RECORDSDefaultArgs> = $Result.GetResult<Prisma.$INVOICE_RECORDSPayload, S>

  type INVOICE_RECORDSCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<INVOICE_RECORDSFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: INVOICE_RECORDSCountAggregateInputType | true
    }

  export interface INVOICE_RECORDSDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['INVOICE_RECORDS'], meta: { name: 'INVOICE_RECORDS' } }
    /**
     * Find zero or one INVOICE_RECORDS that matches the filter.
     * @param {INVOICE_RECORDSFindUniqueArgs} args - Arguments to find a INVOICE_RECORDS
     * @example
     * // Get one INVOICE_RECORDS
     * const iNVOICE_RECORDS = await prisma.iNVOICE_RECORDS.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends INVOICE_RECORDSFindUniqueArgs>(args: SelectSubset<T, INVOICE_RECORDSFindUniqueArgs<ExtArgs>>): Prisma__INVOICE_RECORDSClient<$Result.GetResult<Prisma.$INVOICE_RECORDSPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one INVOICE_RECORDS that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {INVOICE_RECORDSFindUniqueOrThrowArgs} args - Arguments to find a INVOICE_RECORDS
     * @example
     * // Get one INVOICE_RECORDS
     * const iNVOICE_RECORDS = await prisma.iNVOICE_RECORDS.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends INVOICE_RECORDSFindUniqueOrThrowArgs>(args: SelectSubset<T, INVOICE_RECORDSFindUniqueOrThrowArgs<ExtArgs>>): Prisma__INVOICE_RECORDSClient<$Result.GetResult<Prisma.$INVOICE_RECORDSPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first INVOICE_RECORDS that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {INVOICE_RECORDSFindFirstArgs} args - Arguments to find a INVOICE_RECORDS
     * @example
     * // Get one INVOICE_RECORDS
     * const iNVOICE_RECORDS = await prisma.iNVOICE_RECORDS.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends INVOICE_RECORDSFindFirstArgs>(args?: SelectSubset<T, INVOICE_RECORDSFindFirstArgs<ExtArgs>>): Prisma__INVOICE_RECORDSClient<$Result.GetResult<Prisma.$INVOICE_RECORDSPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first INVOICE_RECORDS that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {INVOICE_RECORDSFindFirstOrThrowArgs} args - Arguments to find a INVOICE_RECORDS
     * @example
     * // Get one INVOICE_RECORDS
     * const iNVOICE_RECORDS = await prisma.iNVOICE_RECORDS.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends INVOICE_RECORDSFindFirstOrThrowArgs>(args?: SelectSubset<T, INVOICE_RECORDSFindFirstOrThrowArgs<ExtArgs>>): Prisma__INVOICE_RECORDSClient<$Result.GetResult<Prisma.$INVOICE_RECORDSPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more INVOICE_RECORDS that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {INVOICE_RECORDSFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all INVOICE_RECORDS
     * const iNVOICE_RECORDS = await prisma.iNVOICE_RECORDS.findMany()
     * 
     * // Get first 10 INVOICE_RECORDS
     * const iNVOICE_RECORDS = await prisma.iNVOICE_RECORDS.findMany({ take: 10 })
     * 
     * // Only select the `invoiceID`
     * const iNVOICE_RECORDSWithInvoiceIDOnly = await prisma.iNVOICE_RECORDS.findMany({ select: { invoiceID: true } })
     * 
     */
    findMany<T extends INVOICE_RECORDSFindManyArgs>(args?: SelectSubset<T, INVOICE_RECORDSFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$INVOICE_RECORDSPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a INVOICE_RECORDS.
     * @param {INVOICE_RECORDSCreateArgs} args - Arguments to create a INVOICE_RECORDS.
     * @example
     * // Create one INVOICE_RECORDS
     * const INVOICE_RECORDS = await prisma.iNVOICE_RECORDS.create({
     *   data: {
     *     // ... data to create a INVOICE_RECORDS
     *   }
     * })
     * 
     */
    create<T extends INVOICE_RECORDSCreateArgs>(args: SelectSubset<T, INVOICE_RECORDSCreateArgs<ExtArgs>>): Prisma__INVOICE_RECORDSClient<$Result.GetResult<Prisma.$INVOICE_RECORDSPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many INVOICE_RECORDS.
     * @param {INVOICE_RECORDSCreateManyArgs} args - Arguments to create many INVOICE_RECORDS.
     * @example
     * // Create many INVOICE_RECORDS
     * const iNVOICE_RECORDS = await prisma.iNVOICE_RECORDS.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends INVOICE_RECORDSCreateManyArgs>(args?: SelectSubset<T, INVOICE_RECORDSCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many INVOICE_RECORDS and returns the data saved in the database.
     * @param {INVOICE_RECORDSCreateManyAndReturnArgs} args - Arguments to create many INVOICE_RECORDS.
     * @example
     * // Create many INVOICE_RECORDS
     * const iNVOICE_RECORDS = await prisma.iNVOICE_RECORDS.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many INVOICE_RECORDS and only return the `invoiceID`
     * const iNVOICE_RECORDSWithInvoiceIDOnly = await prisma.iNVOICE_RECORDS.createManyAndReturn({ 
     *   select: { invoiceID: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends INVOICE_RECORDSCreateManyAndReturnArgs>(args?: SelectSubset<T, INVOICE_RECORDSCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$INVOICE_RECORDSPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a INVOICE_RECORDS.
     * @param {INVOICE_RECORDSDeleteArgs} args - Arguments to delete one INVOICE_RECORDS.
     * @example
     * // Delete one INVOICE_RECORDS
     * const INVOICE_RECORDS = await prisma.iNVOICE_RECORDS.delete({
     *   where: {
     *     // ... filter to delete one INVOICE_RECORDS
     *   }
     * })
     * 
     */
    delete<T extends INVOICE_RECORDSDeleteArgs>(args: SelectSubset<T, INVOICE_RECORDSDeleteArgs<ExtArgs>>): Prisma__INVOICE_RECORDSClient<$Result.GetResult<Prisma.$INVOICE_RECORDSPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one INVOICE_RECORDS.
     * @param {INVOICE_RECORDSUpdateArgs} args - Arguments to update one INVOICE_RECORDS.
     * @example
     * // Update one INVOICE_RECORDS
     * const iNVOICE_RECORDS = await prisma.iNVOICE_RECORDS.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends INVOICE_RECORDSUpdateArgs>(args: SelectSubset<T, INVOICE_RECORDSUpdateArgs<ExtArgs>>): Prisma__INVOICE_RECORDSClient<$Result.GetResult<Prisma.$INVOICE_RECORDSPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more INVOICE_RECORDS.
     * @param {INVOICE_RECORDSDeleteManyArgs} args - Arguments to filter INVOICE_RECORDS to delete.
     * @example
     * // Delete a few INVOICE_RECORDS
     * const { count } = await prisma.iNVOICE_RECORDS.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends INVOICE_RECORDSDeleteManyArgs>(args?: SelectSubset<T, INVOICE_RECORDSDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more INVOICE_RECORDS.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {INVOICE_RECORDSUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many INVOICE_RECORDS
     * const iNVOICE_RECORDS = await prisma.iNVOICE_RECORDS.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends INVOICE_RECORDSUpdateManyArgs>(args: SelectSubset<T, INVOICE_RECORDSUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one INVOICE_RECORDS.
     * @param {INVOICE_RECORDSUpsertArgs} args - Arguments to update or create a INVOICE_RECORDS.
     * @example
     * // Update or create a INVOICE_RECORDS
     * const iNVOICE_RECORDS = await prisma.iNVOICE_RECORDS.upsert({
     *   create: {
     *     // ... data to create a INVOICE_RECORDS
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the INVOICE_RECORDS we want to update
     *   }
     * })
     */
    upsert<T extends INVOICE_RECORDSUpsertArgs>(args: SelectSubset<T, INVOICE_RECORDSUpsertArgs<ExtArgs>>): Prisma__INVOICE_RECORDSClient<$Result.GetResult<Prisma.$INVOICE_RECORDSPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of INVOICE_RECORDS.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {INVOICE_RECORDSCountArgs} args - Arguments to filter INVOICE_RECORDS to count.
     * @example
     * // Count the number of INVOICE_RECORDS
     * const count = await prisma.iNVOICE_RECORDS.count({
     *   where: {
     *     // ... the filter for the INVOICE_RECORDS we want to count
     *   }
     * })
    **/
    count<T extends INVOICE_RECORDSCountArgs>(
      args?: Subset<T, INVOICE_RECORDSCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], INVOICE_RECORDSCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a INVOICE_RECORDS.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {INVOICE_RECORDSAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends INVOICE_RECORDSAggregateArgs>(args: Subset<T, INVOICE_RECORDSAggregateArgs>): Prisma.PrismaPromise<GetINVOICE_RECORDSAggregateType<T>>

    /**
     * Group by INVOICE_RECORDS.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {INVOICE_RECORDSGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends INVOICE_RECORDSGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: INVOICE_RECORDSGroupByArgs['orderBy'] }
        : { orderBy?: INVOICE_RECORDSGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, INVOICE_RECORDSGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetINVOICE_RECORDSGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the INVOICE_RECORDS model
   */
  readonly fields: INVOICE_RECORDSFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for INVOICE_RECORDS.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__INVOICE_RECORDSClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    orderItem<T extends orderItemDefaultArgs<ExtArgs> = {}>(args?: Subset<T, orderItemDefaultArgs<ExtArgs>>): Prisma__orderItemClient<$Result.GetResult<Prisma.$orderItemPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the INVOICE_RECORDS model
   */ 
  interface INVOICE_RECORDSFieldRefs {
    readonly invoiceID: FieldRef<"INVOICE_RECORDS", 'Int'>
    readonly ORDER_ID: FieldRef<"INVOICE_RECORDS", 'Int'>
    readonly amount: FieldRef<"INVOICE_RECORDS", 'Float'>
    readonly issuedAt: FieldRef<"INVOICE_RECORDS", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * INVOICE_RECORDS findUnique
   */
  export type INVOICE_RECORDSFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the INVOICE_RECORDS
     */
    select?: INVOICE_RECORDSSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: INVOICE_RECORDSInclude<ExtArgs> | null
    /**
     * Filter, which INVOICE_RECORDS to fetch.
     */
    where: INVOICE_RECORDSWhereUniqueInput
  }

  /**
   * INVOICE_RECORDS findUniqueOrThrow
   */
  export type INVOICE_RECORDSFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the INVOICE_RECORDS
     */
    select?: INVOICE_RECORDSSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: INVOICE_RECORDSInclude<ExtArgs> | null
    /**
     * Filter, which INVOICE_RECORDS to fetch.
     */
    where: INVOICE_RECORDSWhereUniqueInput
  }

  /**
   * INVOICE_RECORDS findFirst
   */
  export type INVOICE_RECORDSFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the INVOICE_RECORDS
     */
    select?: INVOICE_RECORDSSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: INVOICE_RECORDSInclude<ExtArgs> | null
    /**
     * Filter, which INVOICE_RECORDS to fetch.
     */
    where?: INVOICE_RECORDSWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of INVOICE_RECORDS to fetch.
     */
    orderBy?: INVOICE_RECORDSOrderByWithRelationInput | INVOICE_RECORDSOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for INVOICE_RECORDS.
     */
    cursor?: INVOICE_RECORDSWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` INVOICE_RECORDS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` INVOICE_RECORDS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of INVOICE_RECORDS.
     */
    distinct?: INVOICE_RECORDSScalarFieldEnum | INVOICE_RECORDSScalarFieldEnum[]
  }

  /**
   * INVOICE_RECORDS findFirstOrThrow
   */
  export type INVOICE_RECORDSFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the INVOICE_RECORDS
     */
    select?: INVOICE_RECORDSSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: INVOICE_RECORDSInclude<ExtArgs> | null
    /**
     * Filter, which INVOICE_RECORDS to fetch.
     */
    where?: INVOICE_RECORDSWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of INVOICE_RECORDS to fetch.
     */
    orderBy?: INVOICE_RECORDSOrderByWithRelationInput | INVOICE_RECORDSOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for INVOICE_RECORDS.
     */
    cursor?: INVOICE_RECORDSWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` INVOICE_RECORDS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` INVOICE_RECORDS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of INVOICE_RECORDS.
     */
    distinct?: INVOICE_RECORDSScalarFieldEnum | INVOICE_RECORDSScalarFieldEnum[]
  }

  /**
   * INVOICE_RECORDS findMany
   */
  export type INVOICE_RECORDSFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the INVOICE_RECORDS
     */
    select?: INVOICE_RECORDSSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: INVOICE_RECORDSInclude<ExtArgs> | null
    /**
     * Filter, which INVOICE_RECORDS to fetch.
     */
    where?: INVOICE_RECORDSWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of INVOICE_RECORDS to fetch.
     */
    orderBy?: INVOICE_RECORDSOrderByWithRelationInput | INVOICE_RECORDSOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing INVOICE_RECORDS.
     */
    cursor?: INVOICE_RECORDSWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` INVOICE_RECORDS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` INVOICE_RECORDS.
     */
    skip?: number
    distinct?: INVOICE_RECORDSScalarFieldEnum | INVOICE_RECORDSScalarFieldEnum[]
  }

  /**
   * INVOICE_RECORDS create
   */
  export type INVOICE_RECORDSCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the INVOICE_RECORDS
     */
    select?: INVOICE_RECORDSSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: INVOICE_RECORDSInclude<ExtArgs> | null
    /**
     * The data needed to create a INVOICE_RECORDS.
     */
    data: XOR<INVOICE_RECORDSCreateInput, INVOICE_RECORDSUncheckedCreateInput>
  }

  /**
   * INVOICE_RECORDS createMany
   */
  export type INVOICE_RECORDSCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many INVOICE_RECORDS.
     */
    data: INVOICE_RECORDSCreateManyInput | INVOICE_RECORDSCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * INVOICE_RECORDS createManyAndReturn
   */
  export type INVOICE_RECORDSCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the INVOICE_RECORDS
     */
    select?: INVOICE_RECORDSSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many INVOICE_RECORDS.
     */
    data: INVOICE_RECORDSCreateManyInput | INVOICE_RECORDSCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: INVOICE_RECORDSIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * INVOICE_RECORDS update
   */
  export type INVOICE_RECORDSUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the INVOICE_RECORDS
     */
    select?: INVOICE_RECORDSSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: INVOICE_RECORDSInclude<ExtArgs> | null
    /**
     * The data needed to update a INVOICE_RECORDS.
     */
    data: XOR<INVOICE_RECORDSUpdateInput, INVOICE_RECORDSUncheckedUpdateInput>
    /**
     * Choose, which INVOICE_RECORDS to update.
     */
    where: INVOICE_RECORDSWhereUniqueInput
  }

  /**
   * INVOICE_RECORDS updateMany
   */
  export type INVOICE_RECORDSUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update INVOICE_RECORDS.
     */
    data: XOR<INVOICE_RECORDSUpdateManyMutationInput, INVOICE_RECORDSUncheckedUpdateManyInput>
    /**
     * Filter which INVOICE_RECORDS to update
     */
    where?: INVOICE_RECORDSWhereInput
  }

  /**
   * INVOICE_RECORDS upsert
   */
  export type INVOICE_RECORDSUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the INVOICE_RECORDS
     */
    select?: INVOICE_RECORDSSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: INVOICE_RECORDSInclude<ExtArgs> | null
    /**
     * The filter to search for the INVOICE_RECORDS to update in case it exists.
     */
    where: INVOICE_RECORDSWhereUniqueInput
    /**
     * In case the INVOICE_RECORDS found by the `where` argument doesn't exist, create a new INVOICE_RECORDS with this data.
     */
    create: XOR<INVOICE_RECORDSCreateInput, INVOICE_RECORDSUncheckedCreateInput>
    /**
     * In case the INVOICE_RECORDS was found with the provided `where` argument, update it with this data.
     */
    update: XOR<INVOICE_RECORDSUpdateInput, INVOICE_RECORDSUncheckedUpdateInput>
  }

  /**
   * INVOICE_RECORDS delete
   */
  export type INVOICE_RECORDSDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the INVOICE_RECORDS
     */
    select?: INVOICE_RECORDSSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: INVOICE_RECORDSInclude<ExtArgs> | null
    /**
     * Filter which INVOICE_RECORDS to delete.
     */
    where: INVOICE_RECORDSWhereUniqueInput
  }

  /**
   * INVOICE_RECORDS deleteMany
   */
  export type INVOICE_RECORDSDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which INVOICE_RECORDS to delete
     */
    where?: INVOICE_RECORDSWhereInput
  }

  /**
   * INVOICE_RECORDS without action
   */
  export type INVOICE_RECORDSDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the INVOICE_RECORDS
     */
    select?: INVOICE_RECORDSSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: INVOICE_RECORDSInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserAccountScalarFieldEnum: {
    ID: 'ID',
    full_name: 'full_name',
    emailAddress: 'emailAddress',
    createdAt: 'createdAt'
  };

  export type UserAccountScalarFieldEnum = (typeof UserAccountScalarFieldEnum)[keyof typeof UserAccountScalarFieldEnum]


  export const OrderItemScalarFieldEnum: {
    id: 'id',
    ProductName: 'ProductName',
    quantity: 'quantity',
    userID: 'userID',
    created_at: 'created_at'
  };

  export type OrderItemScalarFieldEnum = (typeof OrderItemScalarFieldEnum)[keyof typeof OrderItemScalarFieldEnum]


  export const PRODUCT_CATALOGScalarFieldEnum: {
    product_id: 'product_id',
    productname: 'productname',
    price: 'price',
    category: 'category'
  };

  export type PRODUCT_CATALOGScalarFieldEnum = (typeof PRODUCT_CATALOGScalarFieldEnum)[keyof typeof PRODUCT_CATALOGScalarFieldEnum]


  export const INVOICE_RECORDSScalarFieldEnum: {
    invoiceID: 'invoiceID',
    ORDER_ID: 'ORDER_ID',
    amount: 'amount',
    issuedAt: 'issuedAt'
  };

  export type INVOICE_RECORDSScalarFieldEnum = (typeof INVOICE_RECORDSScalarFieldEnum)[keyof typeof INVOICE_RECORDSScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  /**
   * Field references 
   */


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    


  /**
   * Reference to a field of type 'productCategory'
   */
  export type EnumproductCategoryFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'productCategory'>
    


  /**
   * Reference to a field of type 'productCategory[]'
   */
  export type ListEnumproductCategoryFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'productCategory[]'>
    
  /**
   * Deep Input Types
   */


  export type UserAccountWhereInput = {
    AND?: UserAccountWhereInput | UserAccountWhereInput[]
    OR?: UserAccountWhereInput[]
    NOT?: UserAccountWhereInput | UserAccountWhereInput[]
    ID?: IntFilter<"UserAccount"> | number
    full_name?: StringFilter<"UserAccount"> | string
    emailAddress?: StringFilter<"UserAccount"> | string
    createdAt?: DateTimeFilter<"UserAccount"> | Date | string
    orders?: OrderItemListRelationFilter
  }

  export type UserAccountOrderByWithRelationInput = {
    ID?: SortOrder
    full_name?: SortOrder
    emailAddress?: SortOrder
    createdAt?: SortOrder
    orders?: orderItemOrderByRelationAggregateInput
  }

  export type UserAccountWhereUniqueInput = Prisma.AtLeast<{
    ID?: number
    emailAddress?: string
    AND?: UserAccountWhereInput | UserAccountWhereInput[]
    OR?: UserAccountWhereInput[]
    NOT?: UserAccountWhereInput | UserAccountWhereInput[]
    full_name?: StringFilter<"UserAccount"> | string
    createdAt?: DateTimeFilter<"UserAccount"> | Date | string
    orders?: OrderItemListRelationFilter
  }, "ID" | "emailAddress">

  export type UserAccountOrderByWithAggregationInput = {
    ID?: SortOrder
    full_name?: SortOrder
    emailAddress?: SortOrder
    createdAt?: SortOrder
    _count?: UserAccountCountOrderByAggregateInput
    _avg?: UserAccountAvgOrderByAggregateInput
    _max?: UserAccountMaxOrderByAggregateInput
    _min?: UserAccountMinOrderByAggregateInput
    _sum?: UserAccountSumOrderByAggregateInput
  }

  export type UserAccountScalarWhereWithAggregatesInput = {
    AND?: UserAccountScalarWhereWithAggregatesInput | UserAccountScalarWhereWithAggregatesInput[]
    OR?: UserAccountScalarWhereWithAggregatesInput[]
    NOT?: UserAccountScalarWhereWithAggregatesInput | UserAccountScalarWhereWithAggregatesInput[]
    ID?: IntWithAggregatesFilter<"UserAccount"> | number
    full_name?: StringWithAggregatesFilter<"UserAccount"> | string
    emailAddress?: StringWithAggregatesFilter<"UserAccount"> | string
    createdAt?: DateTimeWithAggregatesFilter<"UserAccount"> | Date | string
  }

  export type orderItemWhereInput = {
    AND?: orderItemWhereInput | orderItemWhereInput[]
    OR?: orderItemWhereInput[]
    NOT?: orderItemWhereInput | orderItemWhereInput[]
    id?: IntFilter<"orderItem"> | number
    ProductName?: StringFilter<"orderItem"> | string
    quantity?: IntFilter<"orderItem"> | number
    userID?: IntFilter<"orderItem"> | number
    created_at?: DateTimeFilter<"orderItem"> | Date | string
    userAccount?: XOR<UserAccountRelationFilter, UserAccountWhereInput>
    INVOICE_RECORDS?: INVOICE_RECORDSListRelationFilter
  }

  export type orderItemOrderByWithRelationInput = {
    id?: SortOrder
    ProductName?: SortOrder
    quantity?: SortOrder
    userID?: SortOrder
    created_at?: SortOrder
    userAccount?: UserAccountOrderByWithRelationInput
    INVOICE_RECORDS?: INVOICE_RECORDSOrderByRelationAggregateInput
  }

  export type orderItemWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: orderItemWhereInput | orderItemWhereInput[]
    OR?: orderItemWhereInput[]
    NOT?: orderItemWhereInput | orderItemWhereInput[]
    ProductName?: StringFilter<"orderItem"> | string
    quantity?: IntFilter<"orderItem"> | number
    userID?: IntFilter<"orderItem"> | number
    created_at?: DateTimeFilter<"orderItem"> | Date | string
    userAccount?: XOR<UserAccountRelationFilter, UserAccountWhereInput>
    INVOICE_RECORDS?: INVOICE_RECORDSListRelationFilter
  }, "id">

  export type orderItemOrderByWithAggregationInput = {
    id?: SortOrder
    ProductName?: SortOrder
    quantity?: SortOrder
    userID?: SortOrder
    created_at?: SortOrder
    _count?: orderItemCountOrderByAggregateInput
    _avg?: orderItemAvgOrderByAggregateInput
    _max?: orderItemMaxOrderByAggregateInput
    _min?: orderItemMinOrderByAggregateInput
    _sum?: orderItemSumOrderByAggregateInput
  }

  export type orderItemScalarWhereWithAggregatesInput = {
    AND?: orderItemScalarWhereWithAggregatesInput | orderItemScalarWhereWithAggregatesInput[]
    OR?: orderItemScalarWhereWithAggregatesInput[]
    NOT?: orderItemScalarWhereWithAggregatesInput | orderItemScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"orderItem"> | number
    ProductName?: StringWithAggregatesFilter<"orderItem"> | string
    quantity?: IntWithAggregatesFilter<"orderItem"> | number
    userID?: IntWithAggregatesFilter<"orderItem"> | number
    created_at?: DateTimeWithAggregatesFilter<"orderItem"> | Date | string
  }

  export type PRODUCT_CATALOGWhereInput = {
    AND?: PRODUCT_CATALOGWhereInput | PRODUCT_CATALOGWhereInput[]
    OR?: PRODUCT_CATALOGWhereInput[]
    NOT?: PRODUCT_CATALOGWhereInput | PRODUCT_CATALOGWhereInput[]
    product_id?: IntFilter<"PRODUCT_CATALOG"> | number
    productname?: StringFilter<"PRODUCT_CATALOG"> | string
    price?: FloatFilter<"PRODUCT_CATALOG"> | number
    category?: EnumproductCategoryFilter<"PRODUCT_CATALOG"> | $Enums.productCategory
  }

  export type PRODUCT_CATALOGOrderByWithRelationInput = {
    product_id?: SortOrder
    productname?: SortOrder
    price?: SortOrder
    category?: SortOrder
  }

  export type PRODUCT_CATALOGWhereUniqueInput = Prisma.AtLeast<{
    product_id?: number
    AND?: PRODUCT_CATALOGWhereInput | PRODUCT_CATALOGWhereInput[]
    OR?: PRODUCT_CATALOGWhereInput[]
    NOT?: PRODUCT_CATALOGWhereInput | PRODUCT_CATALOGWhereInput[]
    productname?: StringFilter<"PRODUCT_CATALOG"> | string
    price?: FloatFilter<"PRODUCT_CATALOG"> | number
    category?: EnumproductCategoryFilter<"PRODUCT_CATALOG"> | $Enums.productCategory
  }, "product_id">

  export type PRODUCT_CATALOGOrderByWithAggregationInput = {
    product_id?: SortOrder
    productname?: SortOrder
    price?: SortOrder
    category?: SortOrder
    _count?: PRODUCT_CATALOGCountOrderByAggregateInput
    _avg?: PRODUCT_CATALOGAvgOrderByAggregateInput
    _max?: PRODUCT_CATALOGMaxOrderByAggregateInput
    _min?: PRODUCT_CATALOGMinOrderByAggregateInput
    _sum?: PRODUCT_CATALOGSumOrderByAggregateInput
  }

  export type PRODUCT_CATALOGScalarWhereWithAggregatesInput = {
    AND?: PRODUCT_CATALOGScalarWhereWithAggregatesInput | PRODUCT_CATALOGScalarWhereWithAggregatesInput[]
    OR?: PRODUCT_CATALOGScalarWhereWithAggregatesInput[]
    NOT?: PRODUCT_CATALOGScalarWhereWithAggregatesInput | PRODUCT_CATALOGScalarWhereWithAggregatesInput[]
    product_id?: IntWithAggregatesFilter<"PRODUCT_CATALOG"> | number
    productname?: StringWithAggregatesFilter<"PRODUCT_CATALOG"> | string
    price?: FloatWithAggregatesFilter<"PRODUCT_CATALOG"> | number
    category?: EnumproductCategoryWithAggregatesFilter<"PRODUCT_CATALOG"> | $Enums.productCategory
  }

  export type INVOICE_RECORDSWhereInput = {
    AND?: INVOICE_RECORDSWhereInput | INVOICE_RECORDSWhereInput[]
    OR?: INVOICE_RECORDSWhereInput[]
    NOT?: INVOICE_RECORDSWhereInput | INVOICE_RECORDSWhereInput[]
    invoiceID?: IntFilter<"INVOICE_RECORDS"> | number
    ORDER_ID?: IntFilter<"INVOICE_RECORDS"> | number
    amount?: FloatFilter<"INVOICE_RECORDS"> | number
    issuedAt?: DateTimeFilter<"INVOICE_RECORDS"> | Date | string
    orderItem?: XOR<OrderItemRelationFilter, orderItemWhereInput>
  }

  export type INVOICE_RECORDSOrderByWithRelationInput = {
    invoiceID?: SortOrder
    ORDER_ID?: SortOrder
    amount?: SortOrder
    issuedAt?: SortOrder
    orderItem?: orderItemOrderByWithRelationInput
  }

  export type INVOICE_RECORDSWhereUniqueInput = Prisma.AtLeast<{
    invoiceID?: number
    AND?: INVOICE_RECORDSWhereInput | INVOICE_RECORDSWhereInput[]
    OR?: INVOICE_RECORDSWhereInput[]
    NOT?: INVOICE_RECORDSWhereInput | INVOICE_RECORDSWhereInput[]
    ORDER_ID?: IntFilter<"INVOICE_RECORDS"> | number
    amount?: FloatFilter<"INVOICE_RECORDS"> | number
    issuedAt?: DateTimeFilter<"INVOICE_RECORDS"> | Date | string
    orderItem?: XOR<OrderItemRelationFilter, orderItemWhereInput>
  }, "invoiceID">

  export type INVOICE_RECORDSOrderByWithAggregationInput = {
    invoiceID?: SortOrder
    ORDER_ID?: SortOrder
    amount?: SortOrder
    issuedAt?: SortOrder
    _count?: INVOICE_RECORDSCountOrderByAggregateInput
    _avg?: INVOICE_RECORDSAvgOrderByAggregateInput
    _max?: INVOICE_RECORDSMaxOrderByAggregateInput
    _min?: INVOICE_RECORDSMinOrderByAggregateInput
    _sum?: INVOICE_RECORDSSumOrderByAggregateInput
  }

  export type INVOICE_RECORDSScalarWhereWithAggregatesInput = {
    AND?: INVOICE_RECORDSScalarWhereWithAggregatesInput | INVOICE_RECORDSScalarWhereWithAggregatesInput[]
    OR?: INVOICE_RECORDSScalarWhereWithAggregatesInput[]
    NOT?: INVOICE_RECORDSScalarWhereWithAggregatesInput | INVOICE_RECORDSScalarWhereWithAggregatesInput[]
    invoiceID?: IntWithAggregatesFilter<"INVOICE_RECORDS"> | number
    ORDER_ID?: IntWithAggregatesFilter<"INVOICE_RECORDS"> | number
    amount?: FloatWithAggregatesFilter<"INVOICE_RECORDS"> | number
    issuedAt?: DateTimeWithAggregatesFilter<"INVOICE_RECORDS"> | Date | string
  }

  export type UserAccountCreateInput = {
    full_name: string
    emailAddress: string
    createdAt?: Date | string
    orders?: orderItemCreateNestedManyWithoutUserAccountInput
  }

  export type UserAccountUncheckedCreateInput = {
    ID?: number
    full_name: string
    emailAddress: string
    createdAt?: Date | string
    orders?: orderItemUncheckedCreateNestedManyWithoutUserAccountInput
  }

  export type UserAccountUpdateInput = {
    full_name?: StringFieldUpdateOperationsInput | string
    emailAddress?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orders?: orderItemUpdateManyWithoutUserAccountNestedInput
  }

  export type UserAccountUncheckedUpdateInput = {
    ID?: IntFieldUpdateOperationsInput | number
    full_name?: StringFieldUpdateOperationsInput | string
    emailAddress?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orders?: orderItemUncheckedUpdateManyWithoutUserAccountNestedInput
  }

  export type UserAccountCreateManyInput = {
    ID?: number
    full_name: string
    emailAddress: string
    createdAt?: Date | string
  }

  export type UserAccountUpdateManyMutationInput = {
    full_name?: StringFieldUpdateOperationsInput | string
    emailAddress?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserAccountUncheckedUpdateManyInput = {
    ID?: IntFieldUpdateOperationsInput | number
    full_name?: StringFieldUpdateOperationsInput | string
    emailAddress?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type orderItemCreateInput = {
    ProductName: string
    quantity: number
    created_at?: Date | string
    userAccount: UserAccountCreateNestedOneWithoutOrdersInput
    INVOICE_RECORDS?: INVOICE_RECORDSCreateNestedManyWithoutOrderItemInput
  }

  export type orderItemUncheckedCreateInput = {
    id?: number
    ProductName: string
    quantity: number
    userID: number
    created_at?: Date | string
    INVOICE_RECORDS?: INVOICE_RECORDSUncheckedCreateNestedManyWithoutOrderItemInput
  }

  export type orderItemUpdateInput = {
    ProductName?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    userAccount?: UserAccountUpdateOneRequiredWithoutOrdersNestedInput
    INVOICE_RECORDS?: INVOICE_RECORDSUpdateManyWithoutOrderItemNestedInput
  }

  export type orderItemUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    ProductName?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    userID?: IntFieldUpdateOperationsInput | number
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    INVOICE_RECORDS?: INVOICE_RECORDSUncheckedUpdateManyWithoutOrderItemNestedInput
  }

  export type orderItemCreateManyInput = {
    id?: number
    ProductName: string
    quantity: number
    userID: number
    created_at?: Date | string
  }

  export type orderItemUpdateManyMutationInput = {
    ProductName?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type orderItemUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    ProductName?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    userID?: IntFieldUpdateOperationsInput | number
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PRODUCT_CATALOGCreateInput = {
    productname: string
    price: number
    category: $Enums.productCategory
  }

  export type PRODUCT_CATALOGUncheckedCreateInput = {
    product_id?: number
    productname: string
    price: number
    category: $Enums.productCategory
  }

  export type PRODUCT_CATALOGUpdateInput = {
    productname?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    category?: EnumproductCategoryFieldUpdateOperationsInput | $Enums.productCategory
  }

  export type PRODUCT_CATALOGUncheckedUpdateInput = {
    product_id?: IntFieldUpdateOperationsInput | number
    productname?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    category?: EnumproductCategoryFieldUpdateOperationsInput | $Enums.productCategory
  }

  export type PRODUCT_CATALOGCreateManyInput = {
    product_id?: number
    productname: string
    price: number
    category: $Enums.productCategory
  }

  export type PRODUCT_CATALOGUpdateManyMutationInput = {
    productname?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    category?: EnumproductCategoryFieldUpdateOperationsInput | $Enums.productCategory
  }

  export type PRODUCT_CATALOGUncheckedUpdateManyInput = {
    product_id?: IntFieldUpdateOperationsInput | number
    productname?: StringFieldUpdateOperationsInput | string
    price?: FloatFieldUpdateOperationsInput | number
    category?: EnumproductCategoryFieldUpdateOperationsInput | $Enums.productCategory
  }

  export type INVOICE_RECORDSCreateInput = {
    amount: number
    issuedAt?: Date | string
    orderItem: orderItemCreateNestedOneWithoutINVOICE_RECORDSInput
  }

  export type INVOICE_RECORDSUncheckedCreateInput = {
    invoiceID?: number
    ORDER_ID: number
    amount: number
    issuedAt?: Date | string
  }

  export type INVOICE_RECORDSUpdateInput = {
    amount?: FloatFieldUpdateOperationsInput | number
    issuedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    orderItem?: orderItemUpdateOneRequiredWithoutINVOICE_RECORDSNestedInput
  }

  export type INVOICE_RECORDSUncheckedUpdateInput = {
    invoiceID?: IntFieldUpdateOperationsInput | number
    ORDER_ID?: IntFieldUpdateOperationsInput | number
    amount?: FloatFieldUpdateOperationsInput | number
    issuedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type INVOICE_RECORDSCreateManyInput = {
    invoiceID?: number
    ORDER_ID: number
    amount: number
    issuedAt?: Date | string
  }

  export type INVOICE_RECORDSUpdateManyMutationInput = {
    amount?: FloatFieldUpdateOperationsInput | number
    issuedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type INVOICE_RECORDSUncheckedUpdateManyInput = {
    invoiceID?: IntFieldUpdateOperationsInput | number
    ORDER_ID?: IntFieldUpdateOperationsInput | number
    amount?: FloatFieldUpdateOperationsInput | number
    issuedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type OrderItemListRelationFilter = {
    every?: orderItemWhereInput
    some?: orderItemWhereInput
    none?: orderItemWhereInput
  }

  export type orderItemOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserAccountCountOrderByAggregateInput = {
    ID?: SortOrder
    full_name?: SortOrder
    emailAddress?: SortOrder
    createdAt?: SortOrder
  }

  export type UserAccountAvgOrderByAggregateInput = {
    ID?: SortOrder
  }

  export type UserAccountMaxOrderByAggregateInput = {
    ID?: SortOrder
    full_name?: SortOrder
    emailAddress?: SortOrder
    createdAt?: SortOrder
  }

  export type UserAccountMinOrderByAggregateInput = {
    ID?: SortOrder
    full_name?: SortOrder
    emailAddress?: SortOrder
    createdAt?: SortOrder
  }

  export type UserAccountSumOrderByAggregateInput = {
    ID?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type UserAccountRelationFilter = {
    is?: UserAccountWhereInput
    isNot?: UserAccountWhereInput
  }

  export type INVOICE_RECORDSListRelationFilter = {
    every?: INVOICE_RECORDSWhereInput
    some?: INVOICE_RECORDSWhereInput
    none?: INVOICE_RECORDSWhereInput
  }

  export type INVOICE_RECORDSOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type orderItemCountOrderByAggregateInput = {
    id?: SortOrder
    ProductName?: SortOrder
    quantity?: SortOrder
    userID?: SortOrder
    created_at?: SortOrder
  }

  export type orderItemAvgOrderByAggregateInput = {
    id?: SortOrder
    quantity?: SortOrder
    userID?: SortOrder
  }

  export type orderItemMaxOrderByAggregateInput = {
    id?: SortOrder
    ProductName?: SortOrder
    quantity?: SortOrder
    userID?: SortOrder
    created_at?: SortOrder
  }

  export type orderItemMinOrderByAggregateInput = {
    id?: SortOrder
    ProductName?: SortOrder
    quantity?: SortOrder
    userID?: SortOrder
    created_at?: SortOrder
  }

  export type orderItemSumOrderByAggregateInput = {
    id?: SortOrder
    quantity?: SortOrder
    userID?: SortOrder
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type EnumproductCategoryFilter<$PrismaModel = never> = {
    equals?: $Enums.productCategory | EnumproductCategoryFieldRefInput<$PrismaModel>
    in?: $Enums.productCategory[] | ListEnumproductCategoryFieldRefInput<$PrismaModel>
    notIn?: $Enums.productCategory[] | ListEnumproductCategoryFieldRefInput<$PrismaModel>
    not?: NestedEnumproductCategoryFilter<$PrismaModel> | $Enums.productCategory
  }

  export type PRODUCT_CATALOGCountOrderByAggregateInput = {
    product_id?: SortOrder
    productname?: SortOrder
    price?: SortOrder
    category?: SortOrder
  }

  export type PRODUCT_CATALOGAvgOrderByAggregateInput = {
    product_id?: SortOrder
    price?: SortOrder
  }

  export type PRODUCT_CATALOGMaxOrderByAggregateInput = {
    product_id?: SortOrder
    productname?: SortOrder
    price?: SortOrder
    category?: SortOrder
  }

  export type PRODUCT_CATALOGMinOrderByAggregateInput = {
    product_id?: SortOrder
    productname?: SortOrder
    price?: SortOrder
    category?: SortOrder
  }

  export type PRODUCT_CATALOGSumOrderByAggregateInput = {
    product_id?: SortOrder
    price?: SortOrder
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type EnumproductCategoryWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.productCategory | EnumproductCategoryFieldRefInput<$PrismaModel>
    in?: $Enums.productCategory[] | ListEnumproductCategoryFieldRefInput<$PrismaModel>
    notIn?: $Enums.productCategory[] | ListEnumproductCategoryFieldRefInput<$PrismaModel>
    not?: NestedEnumproductCategoryWithAggregatesFilter<$PrismaModel> | $Enums.productCategory
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumproductCategoryFilter<$PrismaModel>
    _max?: NestedEnumproductCategoryFilter<$PrismaModel>
  }

  export type OrderItemRelationFilter = {
    is?: orderItemWhereInput
    isNot?: orderItemWhereInput
  }

  export type INVOICE_RECORDSCountOrderByAggregateInput = {
    invoiceID?: SortOrder
    ORDER_ID?: SortOrder
    amount?: SortOrder
    issuedAt?: SortOrder
  }

  export type INVOICE_RECORDSAvgOrderByAggregateInput = {
    invoiceID?: SortOrder
    ORDER_ID?: SortOrder
    amount?: SortOrder
  }

  export type INVOICE_RECORDSMaxOrderByAggregateInput = {
    invoiceID?: SortOrder
    ORDER_ID?: SortOrder
    amount?: SortOrder
    issuedAt?: SortOrder
  }

  export type INVOICE_RECORDSMinOrderByAggregateInput = {
    invoiceID?: SortOrder
    ORDER_ID?: SortOrder
    amount?: SortOrder
    issuedAt?: SortOrder
  }

  export type INVOICE_RECORDSSumOrderByAggregateInput = {
    invoiceID?: SortOrder
    ORDER_ID?: SortOrder
    amount?: SortOrder
  }

  export type orderItemCreateNestedManyWithoutUserAccountInput = {
    create?: XOR<orderItemCreateWithoutUserAccountInput, orderItemUncheckedCreateWithoutUserAccountInput> | orderItemCreateWithoutUserAccountInput[] | orderItemUncheckedCreateWithoutUserAccountInput[]
    connectOrCreate?: orderItemCreateOrConnectWithoutUserAccountInput | orderItemCreateOrConnectWithoutUserAccountInput[]
    createMany?: orderItemCreateManyUserAccountInputEnvelope
    connect?: orderItemWhereUniqueInput | orderItemWhereUniqueInput[]
  }

  export type orderItemUncheckedCreateNestedManyWithoutUserAccountInput = {
    create?: XOR<orderItemCreateWithoutUserAccountInput, orderItemUncheckedCreateWithoutUserAccountInput> | orderItemCreateWithoutUserAccountInput[] | orderItemUncheckedCreateWithoutUserAccountInput[]
    connectOrCreate?: orderItemCreateOrConnectWithoutUserAccountInput | orderItemCreateOrConnectWithoutUserAccountInput[]
    createMany?: orderItemCreateManyUserAccountInputEnvelope
    connect?: orderItemWhereUniqueInput | orderItemWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type orderItemUpdateManyWithoutUserAccountNestedInput = {
    create?: XOR<orderItemCreateWithoutUserAccountInput, orderItemUncheckedCreateWithoutUserAccountInput> | orderItemCreateWithoutUserAccountInput[] | orderItemUncheckedCreateWithoutUserAccountInput[]
    connectOrCreate?: orderItemCreateOrConnectWithoutUserAccountInput | orderItemCreateOrConnectWithoutUserAccountInput[]
    upsert?: orderItemUpsertWithWhereUniqueWithoutUserAccountInput | orderItemUpsertWithWhereUniqueWithoutUserAccountInput[]
    createMany?: orderItemCreateManyUserAccountInputEnvelope
    set?: orderItemWhereUniqueInput | orderItemWhereUniqueInput[]
    disconnect?: orderItemWhereUniqueInput | orderItemWhereUniqueInput[]
    delete?: orderItemWhereUniqueInput | orderItemWhereUniqueInput[]
    connect?: orderItemWhereUniqueInput | orderItemWhereUniqueInput[]
    update?: orderItemUpdateWithWhereUniqueWithoutUserAccountInput | orderItemUpdateWithWhereUniqueWithoutUserAccountInput[]
    updateMany?: orderItemUpdateManyWithWhereWithoutUserAccountInput | orderItemUpdateManyWithWhereWithoutUserAccountInput[]
    deleteMany?: orderItemScalarWhereInput | orderItemScalarWhereInput[]
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type orderItemUncheckedUpdateManyWithoutUserAccountNestedInput = {
    create?: XOR<orderItemCreateWithoutUserAccountInput, orderItemUncheckedCreateWithoutUserAccountInput> | orderItemCreateWithoutUserAccountInput[] | orderItemUncheckedCreateWithoutUserAccountInput[]
    connectOrCreate?: orderItemCreateOrConnectWithoutUserAccountInput | orderItemCreateOrConnectWithoutUserAccountInput[]
    upsert?: orderItemUpsertWithWhereUniqueWithoutUserAccountInput | orderItemUpsertWithWhereUniqueWithoutUserAccountInput[]
    createMany?: orderItemCreateManyUserAccountInputEnvelope
    set?: orderItemWhereUniqueInput | orderItemWhereUniqueInput[]
    disconnect?: orderItemWhereUniqueInput | orderItemWhereUniqueInput[]
    delete?: orderItemWhereUniqueInput | orderItemWhereUniqueInput[]
    connect?: orderItemWhereUniqueInput | orderItemWhereUniqueInput[]
    update?: orderItemUpdateWithWhereUniqueWithoutUserAccountInput | orderItemUpdateWithWhereUniqueWithoutUserAccountInput[]
    updateMany?: orderItemUpdateManyWithWhereWithoutUserAccountInput | orderItemUpdateManyWithWhereWithoutUserAccountInput[]
    deleteMany?: orderItemScalarWhereInput | orderItemScalarWhereInput[]
  }

  export type UserAccountCreateNestedOneWithoutOrdersInput = {
    create?: XOR<UserAccountCreateWithoutOrdersInput, UserAccountUncheckedCreateWithoutOrdersInput>
    connectOrCreate?: UserAccountCreateOrConnectWithoutOrdersInput
    connect?: UserAccountWhereUniqueInput
  }

  export type INVOICE_RECORDSCreateNestedManyWithoutOrderItemInput = {
    create?: XOR<INVOICE_RECORDSCreateWithoutOrderItemInput, INVOICE_RECORDSUncheckedCreateWithoutOrderItemInput> | INVOICE_RECORDSCreateWithoutOrderItemInput[] | INVOICE_RECORDSUncheckedCreateWithoutOrderItemInput[]
    connectOrCreate?: INVOICE_RECORDSCreateOrConnectWithoutOrderItemInput | INVOICE_RECORDSCreateOrConnectWithoutOrderItemInput[]
    createMany?: INVOICE_RECORDSCreateManyOrderItemInputEnvelope
    connect?: INVOICE_RECORDSWhereUniqueInput | INVOICE_RECORDSWhereUniqueInput[]
  }

  export type INVOICE_RECORDSUncheckedCreateNestedManyWithoutOrderItemInput = {
    create?: XOR<INVOICE_RECORDSCreateWithoutOrderItemInput, INVOICE_RECORDSUncheckedCreateWithoutOrderItemInput> | INVOICE_RECORDSCreateWithoutOrderItemInput[] | INVOICE_RECORDSUncheckedCreateWithoutOrderItemInput[]
    connectOrCreate?: INVOICE_RECORDSCreateOrConnectWithoutOrderItemInput | INVOICE_RECORDSCreateOrConnectWithoutOrderItemInput[]
    createMany?: INVOICE_RECORDSCreateManyOrderItemInputEnvelope
    connect?: INVOICE_RECORDSWhereUniqueInput | INVOICE_RECORDSWhereUniqueInput[]
  }

  export type UserAccountUpdateOneRequiredWithoutOrdersNestedInput = {
    create?: XOR<UserAccountCreateWithoutOrdersInput, UserAccountUncheckedCreateWithoutOrdersInput>
    connectOrCreate?: UserAccountCreateOrConnectWithoutOrdersInput
    upsert?: UserAccountUpsertWithoutOrdersInput
    connect?: UserAccountWhereUniqueInput
    update?: XOR<XOR<UserAccountUpdateToOneWithWhereWithoutOrdersInput, UserAccountUpdateWithoutOrdersInput>, UserAccountUncheckedUpdateWithoutOrdersInput>
  }

  export type INVOICE_RECORDSUpdateManyWithoutOrderItemNestedInput = {
    create?: XOR<INVOICE_RECORDSCreateWithoutOrderItemInput, INVOICE_RECORDSUncheckedCreateWithoutOrderItemInput> | INVOICE_RECORDSCreateWithoutOrderItemInput[] | INVOICE_RECORDSUncheckedCreateWithoutOrderItemInput[]
    connectOrCreate?: INVOICE_RECORDSCreateOrConnectWithoutOrderItemInput | INVOICE_RECORDSCreateOrConnectWithoutOrderItemInput[]
    upsert?: INVOICE_RECORDSUpsertWithWhereUniqueWithoutOrderItemInput | INVOICE_RECORDSUpsertWithWhereUniqueWithoutOrderItemInput[]
    createMany?: INVOICE_RECORDSCreateManyOrderItemInputEnvelope
    set?: INVOICE_RECORDSWhereUniqueInput | INVOICE_RECORDSWhereUniqueInput[]
    disconnect?: INVOICE_RECORDSWhereUniqueInput | INVOICE_RECORDSWhereUniqueInput[]
    delete?: INVOICE_RECORDSWhereUniqueInput | INVOICE_RECORDSWhereUniqueInput[]
    connect?: INVOICE_RECORDSWhereUniqueInput | INVOICE_RECORDSWhereUniqueInput[]
    update?: INVOICE_RECORDSUpdateWithWhereUniqueWithoutOrderItemInput | INVOICE_RECORDSUpdateWithWhereUniqueWithoutOrderItemInput[]
    updateMany?: INVOICE_RECORDSUpdateManyWithWhereWithoutOrderItemInput | INVOICE_RECORDSUpdateManyWithWhereWithoutOrderItemInput[]
    deleteMany?: INVOICE_RECORDSScalarWhereInput | INVOICE_RECORDSScalarWhereInput[]
  }

  export type INVOICE_RECORDSUncheckedUpdateManyWithoutOrderItemNestedInput = {
    create?: XOR<INVOICE_RECORDSCreateWithoutOrderItemInput, INVOICE_RECORDSUncheckedCreateWithoutOrderItemInput> | INVOICE_RECORDSCreateWithoutOrderItemInput[] | INVOICE_RECORDSUncheckedCreateWithoutOrderItemInput[]
    connectOrCreate?: INVOICE_RECORDSCreateOrConnectWithoutOrderItemInput | INVOICE_RECORDSCreateOrConnectWithoutOrderItemInput[]
    upsert?: INVOICE_RECORDSUpsertWithWhereUniqueWithoutOrderItemInput | INVOICE_RECORDSUpsertWithWhereUniqueWithoutOrderItemInput[]
    createMany?: INVOICE_RECORDSCreateManyOrderItemInputEnvelope
    set?: INVOICE_RECORDSWhereUniqueInput | INVOICE_RECORDSWhereUniqueInput[]
    disconnect?: INVOICE_RECORDSWhereUniqueInput | INVOICE_RECORDSWhereUniqueInput[]
    delete?: INVOICE_RECORDSWhereUniqueInput | INVOICE_RECORDSWhereUniqueInput[]
    connect?: INVOICE_RECORDSWhereUniqueInput | INVOICE_RECORDSWhereUniqueInput[]
    update?: INVOICE_RECORDSUpdateWithWhereUniqueWithoutOrderItemInput | INVOICE_RECORDSUpdateWithWhereUniqueWithoutOrderItemInput[]
    updateMany?: INVOICE_RECORDSUpdateManyWithWhereWithoutOrderItemInput | INVOICE_RECORDSUpdateManyWithWhereWithoutOrderItemInput[]
    deleteMany?: INVOICE_RECORDSScalarWhereInput | INVOICE_RECORDSScalarWhereInput[]
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type EnumproductCategoryFieldUpdateOperationsInput = {
    set?: $Enums.productCategory
  }

  export type orderItemCreateNestedOneWithoutINVOICE_RECORDSInput = {
    create?: XOR<orderItemCreateWithoutINVOICE_RECORDSInput, orderItemUncheckedCreateWithoutINVOICE_RECORDSInput>
    connectOrCreate?: orderItemCreateOrConnectWithoutINVOICE_RECORDSInput
    connect?: orderItemWhereUniqueInput
  }

  export type orderItemUpdateOneRequiredWithoutINVOICE_RECORDSNestedInput = {
    create?: XOR<orderItemCreateWithoutINVOICE_RECORDSInput, orderItemUncheckedCreateWithoutINVOICE_RECORDSInput>
    connectOrCreate?: orderItemCreateOrConnectWithoutINVOICE_RECORDSInput
    upsert?: orderItemUpsertWithoutINVOICE_RECORDSInput
    connect?: orderItemWhereUniqueInput
    update?: XOR<XOR<orderItemUpdateToOneWithWhereWithoutINVOICE_RECORDSInput, orderItemUpdateWithoutINVOICE_RECORDSInput>, orderItemUncheckedUpdateWithoutINVOICE_RECORDSInput>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedEnumproductCategoryFilter<$PrismaModel = never> = {
    equals?: $Enums.productCategory | EnumproductCategoryFieldRefInput<$PrismaModel>
    in?: $Enums.productCategory[] | ListEnumproductCategoryFieldRefInput<$PrismaModel>
    notIn?: $Enums.productCategory[] | ListEnumproductCategoryFieldRefInput<$PrismaModel>
    not?: NestedEnumproductCategoryFilter<$PrismaModel> | $Enums.productCategory
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type NestedEnumproductCategoryWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.productCategory | EnumproductCategoryFieldRefInput<$PrismaModel>
    in?: $Enums.productCategory[] | ListEnumproductCategoryFieldRefInput<$PrismaModel>
    notIn?: $Enums.productCategory[] | ListEnumproductCategoryFieldRefInput<$PrismaModel>
    not?: NestedEnumproductCategoryWithAggregatesFilter<$PrismaModel> | $Enums.productCategory
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumproductCategoryFilter<$PrismaModel>
    _max?: NestedEnumproductCategoryFilter<$PrismaModel>
  }

  export type orderItemCreateWithoutUserAccountInput = {
    ProductName: string
    quantity: number
    created_at?: Date | string
    INVOICE_RECORDS?: INVOICE_RECORDSCreateNestedManyWithoutOrderItemInput
  }

  export type orderItemUncheckedCreateWithoutUserAccountInput = {
    id?: number
    ProductName: string
    quantity: number
    created_at?: Date | string
    INVOICE_RECORDS?: INVOICE_RECORDSUncheckedCreateNestedManyWithoutOrderItemInput
  }

  export type orderItemCreateOrConnectWithoutUserAccountInput = {
    where: orderItemWhereUniqueInput
    create: XOR<orderItemCreateWithoutUserAccountInput, orderItemUncheckedCreateWithoutUserAccountInput>
  }

  export type orderItemCreateManyUserAccountInputEnvelope = {
    data: orderItemCreateManyUserAccountInput | orderItemCreateManyUserAccountInput[]
    skipDuplicates?: boolean
  }

  export type orderItemUpsertWithWhereUniqueWithoutUserAccountInput = {
    where: orderItemWhereUniqueInput
    update: XOR<orderItemUpdateWithoutUserAccountInput, orderItemUncheckedUpdateWithoutUserAccountInput>
    create: XOR<orderItemCreateWithoutUserAccountInput, orderItemUncheckedCreateWithoutUserAccountInput>
  }

  export type orderItemUpdateWithWhereUniqueWithoutUserAccountInput = {
    where: orderItemWhereUniqueInput
    data: XOR<orderItemUpdateWithoutUserAccountInput, orderItemUncheckedUpdateWithoutUserAccountInput>
  }

  export type orderItemUpdateManyWithWhereWithoutUserAccountInput = {
    where: orderItemScalarWhereInput
    data: XOR<orderItemUpdateManyMutationInput, orderItemUncheckedUpdateManyWithoutUserAccountInput>
  }

  export type orderItemScalarWhereInput = {
    AND?: orderItemScalarWhereInput | orderItemScalarWhereInput[]
    OR?: orderItemScalarWhereInput[]
    NOT?: orderItemScalarWhereInput | orderItemScalarWhereInput[]
    id?: IntFilter<"orderItem"> | number
    ProductName?: StringFilter<"orderItem"> | string
    quantity?: IntFilter<"orderItem"> | number
    userID?: IntFilter<"orderItem"> | number
    created_at?: DateTimeFilter<"orderItem"> | Date | string
  }

  export type UserAccountCreateWithoutOrdersInput = {
    full_name: string
    emailAddress: string
    createdAt?: Date | string
  }

  export type UserAccountUncheckedCreateWithoutOrdersInput = {
    ID?: number
    full_name: string
    emailAddress: string
    createdAt?: Date | string
  }

  export type UserAccountCreateOrConnectWithoutOrdersInput = {
    where: UserAccountWhereUniqueInput
    create: XOR<UserAccountCreateWithoutOrdersInput, UserAccountUncheckedCreateWithoutOrdersInput>
  }

  export type INVOICE_RECORDSCreateWithoutOrderItemInput = {
    amount: number
    issuedAt?: Date | string
  }

  export type INVOICE_RECORDSUncheckedCreateWithoutOrderItemInput = {
    invoiceID?: number
    amount: number
    issuedAt?: Date | string
  }

  export type INVOICE_RECORDSCreateOrConnectWithoutOrderItemInput = {
    where: INVOICE_RECORDSWhereUniqueInput
    create: XOR<INVOICE_RECORDSCreateWithoutOrderItemInput, INVOICE_RECORDSUncheckedCreateWithoutOrderItemInput>
  }

  export type INVOICE_RECORDSCreateManyOrderItemInputEnvelope = {
    data: INVOICE_RECORDSCreateManyOrderItemInput | INVOICE_RECORDSCreateManyOrderItemInput[]
    skipDuplicates?: boolean
  }

  export type UserAccountUpsertWithoutOrdersInput = {
    update: XOR<UserAccountUpdateWithoutOrdersInput, UserAccountUncheckedUpdateWithoutOrdersInput>
    create: XOR<UserAccountCreateWithoutOrdersInput, UserAccountUncheckedCreateWithoutOrdersInput>
    where?: UserAccountWhereInput
  }

  export type UserAccountUpdateToOneWithWhereWithoutOrdersInput = {
    where?: UserAccountWhereInput
    data: XOR<UserAccountUpdateWithoutOrdersInput, UserAccountUncheckedUpdateWithoutOrdersInput>
  }

  export type UserAccountUpdateWithoutOrdersInput = {
    full_name?: StringFieldUpdateOperationsInput | string
    emailAddress?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserAccountUncheckedUpdateWithoutOrdersInput = {
    ID?: IntFieldUpdateOperationsInput | number
    full_name?: StringFieldUpdateOperationsInput | string
    emailAddress?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type INVOICE_RECORDSUpsertWithWhereUniqueWithoutOrderItemInput = {
    where: INVOICE_RECORDSWhereUniqueInput
    update: XOR<INVOICE_RECORDSUpdateWithoutOrderItemInput, INVOICE_RECORDSUncheckedUpdateWithoutOrderItemInput>
    create: XOR<INVOICE_RECORDSCreateWithoutOrderItemInput, INVOICE_RECORDSUncheckedCreateWithoutOrderItemInput>
  }

  export type INVOICE_RECORDSUpdateWithWhereUniqueWithoutOrderItemInput = {
    where: INVOICE_RECORDSWhereUniqueInput
    data: XOR<INVOICE_RECORDSUpdateWithoutOrderItemInput, INVOICE_RECORDSUncheckedUpdateWithoutOrderItemInput>
  }

  export type INVOICE_RECORDSUpdateManyWithWhereWithoutOrderItemInput = {
    where: INVOICE_RECORDSScalarWhereInput
    data: XOR<INVOICE_RECORDSUpdateManyMutationInput, INVOICE_RECORDSUncheckedUpdateManyWithoutOrderItemInput>
  }

  export type INVOICE_RECORDSScalarWhereInput = {
    AND?: INVOICE_RECORDSScalarWhereInput | INVOICE_RECORDSScalarWhereInput[]
    OR?: INVOICE_RECORDSScalarWhereInput[]
    NOT?: INVOICE_RECORDSScalarWhereInput | INVOICE_RECORDSScalarWhereInput[]
    invoiceID?: IntFilter<"INVOICE_RECORDS"> | number
    ORDER_ID?: IntFilter<"INVOICE_RECORDS"> | number
    amount?: FloatFilter<"INVOICE_RECORDS"> | number
    issuedAt?: DateTimeFilter<"INVOICE_RECORDS"> | Date | string
  }

  export type orderItemCreateWithoutINVOICE_RECORDSInput = {
    ProductName: string
    quantity: number
    created_at?: Date | string
    userAccount: UserAccountCreateNestedOneWithoutOrdersInput
  }

  export type orderItemUncheckedCreateWithoutINVOICE_RECORDSInput = {
    id?: number
    ProductName: string
    quantity: number
    userID: number
    created_at?: Date | string
  }

  export type orderItemCreateOrConnectWithoutINVOICE_RECORDSInput = {
    where: orderItemWhereUniqueInput
    create: XOR<orderItemCreateWithoutINVOICE_RECORDSInput, orderItemUncheckedCreateWithoutINVOICE_RECORDSInput>
  }

  export type orderItemUpsertWithoutINVOICE_RECORDSInput = {
    update: XOR<orderItemUpdateWithoutINVOICE_RECORDSInput, orderItemUncheckedUpdateWithoutINVOICE_RECORDSInput>
    create: XOR<orderItemCreateWithoutINVOICE_RECORDSInput, orderItemUncheckedCreateWithoutINVOICE_RECORDSInput>
    where?: orderItemWhereInput
  }

  export type orderItemUpdateToOneWithWhereWithoutINVOICE_RECORDSInput = {
    where?: orderItemWhereInput
    data: XOR<orderItemUpdateWithoutINVOICE_RECORDSInput, orderItemUncheckedUpdateWithoutINVOICE_RECORDSInput>
  }

  export type orderItemUpdateWithoutINVOICE_RECORDSInput = {
    ProductName?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    userAccount?: UserAccountUpdateOneRequiredWithoutOrdersNestedInput
  }

  export type orderItemUncheckedUpdateWithoutINVOICE_RECORDSInput = {
    id?: IntFieldUpdateOperationsInput | number
    ProductName?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    userID?: IntFieldUpdateOperationsInput | number
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type orderItemCreateManyUserAccountInput = {
    id?: number
    ProductName: string
    quantity: number
    created_at?: Date | string
  }

  export type orderItemUpdateWithoutUserAccountInput = {
    ProductName?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    INVOICE_RECORDS?: INVOICE_RECORDSUpdateManyWithoutOrderItemNestedInput
  }

  export type orderItemUncheckedUpdateWithoutUserAccountInput = {
    id?: IntFieldUpdateOperationsInput | number
    ProductName?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
    INVOICE_RECORDS?: INVOICE_RECORDSUncheckedUpdateManyWithoutOrderItemNestedInput
  }

  export type orderItemUncheckedUpdateManyWithoutUserAccountInput = {
    id?: IntFieldUpdateOperationsInput | number
    ProductName?: StringFieldUpdateOperationsInput | string
    quantity?: IntFieldUpdateOperationsInput | number
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type INVOICE_RECORDSCreateManyOrderItemInput = {
    invoiceID?: number
    amount: number
    issuedAt?: Date | string
  }

  export type INVOICE_RECORDSUpdateWithoutOrderItemInput = {
    amount?: FloatFieldUpdateOperationsInput | number
    issuedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type INVOICE_RECORDSUncheckedUpdateWithoutOrderItemInput = {
    invoiceID?: IntFieldUpdateOperationsInput | number
    amount?: FloatFieldUpdateOperationsInput | number
    issuedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type INVOICE_RECORDSUncheckedUpdateManyWithoutOrderItemInput = {
    invoiceID?: IntFieldUpdateOperationsInput | number
    amount?: FloatFieldUpdateOperationsInput | number
    issuedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Aliases for legacy arg types
   */
    /**
     * @deprecated Use UserAccountCountOutputTypeDefaultArgs instead
     */
    export type UserAccountCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = UserAccountCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use OrderItemCountOutputTypeDefaultArgs instead
     */
    export type OrderItemCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = OrderItemCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use UserAccountDefaultArgs instead
     */
    export type UserAccountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = UserAccountDefaultArgs<ExtArgs>
    /**
     * @deprecated Use orderItemDefaultArgs instead
     */
    export type orderItemArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = orderItemDefaultArgs<ExtArgs>
    /**
     * @deprecated Use PRODUCT_CATALOGDefaultArgs instead
     */
    export type PRODUCT_CATALOGArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = PRODUCT_CATALOGDefaultArgs<ExtArgs>
    /**
     * @deprecated Use INVOICE_RECORDSDefaultArgs instead
     */
    export type INVOICE_RECORDSArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = INVOICE_RECORDSDefaultArgs<ExtArgs>

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}