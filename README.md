# TypeScript Event Bindings

This is a demo of how you can create typesafe bindings for contract events.

You can refer directly to the `generated.ts` file in this repo to see the output for the example contract after deployment, or you can run the process yourself as follows, once you've funded an account (see the [CLI manual](https://developers.stellar.org/docs/tools/cli/stellar-cli) for help on that):

```bash
npm i
stellar contract build
stellar contract deploy --wasm <path from above> --network testnet --source-account <...>
# remember the contract id
# it's deployed as CBMWOANWBHW5BYJ6GNACCMK2CQVTE6LUAP3XGIRIQK3NXWVOZLHXDSM3 today
npx tsx main.ts CBMWOANWBHW5BYJ6GNACCMK2CQVTE6LUAP3XGIRIQK3NXWVOZLHXDSM3
cat generated.ts

stellar contract invoke <...> -- emit
curl -X POST -H 'Content-Type: application/json' -d '
    { "jsonrpc": "2.0", "id": 1,
     "method": "getTransaction",
     "params": {
        "hash": "<sha from above invoke>"
    }}' https://soroban-testnet.stellar.org/ | jq .result.events.contractEventsXdr[0][0]

# load that base64 into the new `DefaultEvent` object and observe:
```

```typescript
const b64 = "AAAAAAAAAAHISDHhxJ+JSBzDWDgWbWriOirUe4TsyFj1IhuBfaI+CwAAAAEAAAAAAAAAAwAAAA8AAAANZGVmYXVsdF9ldmVudAAAAAAAABIAAAAByEgx4cSfiUgcw1g4Fm1q4joq1HuE7MhY9SIbgX2iPgsAAAADAAAAAgAAABEAAAABAAAAAwAAAA8AAAADYW55AAAAAAQAAAAFAAAADwAAAAZiaWdudW0AAAAAAAp///////////////////0oAAAADwAAAAZuZXN0ZWQAAAAAABAAAAABAAAAAgAAABEAAAABAAAAAQAAAA4AAAAFaGVsbG8AAAAAAAAGAAAAAAAAABsAAAARAAAAAQAAAAEAAAAOAAAABWhlbGxvAAAAAAAABgAAAAAAAAAb";
const e = new DefaultEvent(xdr.ContractEvent.fromXDR(b64, "base64"));
console.info(e.nested);
```

```bash
$ npx tsx generated.ts
[ { hello: 27n }, { hello: 27n } ]
```
