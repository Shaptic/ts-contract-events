import { xdr, Address, scValToNative } from '@stellar/stellar-sdk';

export interface ContractEvent {
  name: string;
}

export class DefaultEvent implements ContractEvent {
  name: string = "DefaultEvent";
  prefix0: string = "default_event";
  private _spec: xdr.ScSpecTypeDef[] = [
    "AAAAEw==", // scSpecTypeAddress
    "AAAABA==", // scSpecTypeU32
    "AAAACw==", // scSpecTypeI128
    "AAAD6gAAA+wAAAAQAAAABw==", // scSpecTypeVec
    "AAAAAA==", // scSpecTypeVal
  ].map(b64 => xdr.ScSpecTypeDef.fromXDR(b64, "base64"));

  private _addr: xdr.ScVal;
  public get addr(): Address {
    return scValToNative(this._addr);
  }

  private _num: xdr.ScVal;
  public get num(): number {
    return scValToNative(this._num);
  }

  private _bignum: xdr.ScVal;
  public get bignum(): bigint {
    return scValToNative(this._bignum);
  }

  private _nested: xdr.ScVal;
  public get nested(): Record<string, bigint>[] {
    return scValToNative(this._nested);
  }

  private _any: xdr.ScVal;
  public get any(): any /* scSpecTypeVal */ {
    return scValToNative(this._any);
  }

  constructor(e: xdr.ContractEvent) {
    const topics = e.body().value().topics();
    const data = e.body().value().data();

    // Validate topics: the first ones should match prefix topics.
    if (topics.length < 3) {
      throw Error(`invalid event: too few topics (${topics.length}), expected 3`);
    }

    [this.prefix0].forEach((t, idx) => {
      if (t !== scValToNative(topics[idx])) {
        throw Error(`invalid event: expected "${t}" as topic ${idx+1}`);
      }
    });

    // Now validate the payload looks like it's described in the spec, too.
    if (data.switch().value !== xdr.ScValType.scvMap().value) {
      throw new Error(`invalid event, expected map, got ${data.switch().name}`);
    }

    this._addr = topics[1];
    this._num = topics[2];

    let expectedData = ["bignum", "nested", "any"];

    data.map()!.forEach((entry) => {
      const name = entry.key().value()?.toString() ?? "undefined";
      if (expectedData.indexOf(name) !== -1) {
        this["_" + name] = entry.val();
        expectedData = expectedData.filter(k => k !== name);
      }
    });
    if (expectedData.length > 0) {
      throw new Error(`expected to find ${
        expectedData.map(k => `'${k}'`).join(", ")
      } in event payload: ${
        JSON.stringify(
          scValToNative(data),
          (_, v) => typeof v === 'bigint' ? v.toString() : v,
          2
        )
      }`);
    }

  }
}

let b64 = "AAAAAAAAAAFZZwG2Ce3Q4T4zQCExWhQrMnl0A/dzIiiCttvarsrPcQAAAAEAAAAAAAAAAwAAAA8AAAANZGVmYXVsdF9ldmVudAAAAAAAABIAAAABWWcBtgnt0OE+M0AhMVoUKzJ5dAP3cyIogrbb2q7Kz3EAAAADAAAAAgAAABEAAAABAAAAAwAAAA8AAAADYW55AAAAAAQAAAAFAAAADwAAAAZiaWdudW0AAAAAAAp///////////////////0oAAAADwAAAAZuZXN0ZWQAAAAAABAAAAABAAAAAgAAABEAAAABAAAAAQAAAA4AAAAFaGVsbG8AAAAAAAAGAAAAAAAAABsAAAARAAAAAQAAAAEAAAAOAAAABWhlbGxvAAAAAAAABgAAAAAAAAAb";
const e = new DefaultEvent(xdr.ContractEvent.fromXDR(b64, "base64")); 
console.info(e);
console.info(e.nested, e.addr, e.num, e.bignum);
