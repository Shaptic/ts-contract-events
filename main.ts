import { exit } from "node:process";
import { writeFileSync } from "node:fs";

import { Contract, Networks, xdr } from "@stellar/stellar-sdk";
import { Client } from "@stellar/stellar-sdk/contract";

export async function main() {
  if (process.argv.length !== 3) {
    console.error(`Usage: ${process.argv0} <contract-id>`);
    exit(1);
  }

  const cid = process.argv[2];
  console.info(`Generating script for ${cid}.`);

  const c = new Contract(cid);
  const cli = await Client.from({
    contractId: c.contractId(),
    networkPassphrase: Networks.TESTNET,
    rpcUrl: "https://soroban-testnet.stellar.org",
  });

  let eventGen = `import { xdr, Address, scValToNative } from '@stellar/stellar-sdk';

export interface ContractEvent {
  name: string;
}
\n`;
  const inTopicList =
    xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationTopicList();
  const inPayload =
    xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationData();

  cli.spec.entries
    .filter(
      (entry) =>
        entry.switch().value === xdr.ScSpecEntryKind.scSpecEntryEventV0().value,
    )
    .forEach((entry, _j) => {
      const e = entry.eventV0();
      const topicParams = e
        .params()
        .filter((p) => p.location().value === inTopicList.value);
      const dataParams = e
        .params()
        .filter((p) => p.location().value === inPayload.value);

      eventGen += `export class ${e.name()} implements ContractEvent {
  name: string = "${e.name()}";
`;
      e.prefixTopics().forEach((t, idx) => {
        eventGen += `  prefix${idx}: string = "${t.toString()}";\n`;
      });

      eventGen += `  private _spec: xdr.ScSpecTypeDef[] = [\n`;
      e.params().forEach((p) => {
        eventGen += `    "${p.type().toXDR("base64")}", // ${p.type().switch().name}\n`;
      });
      eventGen += `  ].map(b64 => xdr.ScSpecTypeDef.fromXDR(b64, "base64"));\n`;

      e.params().forEach((p) => {
        let type = specTypeToNative(p.type());
        let body = `return scValToNative(this._${p.name()});`;
        if (type === "any") {
          body = `    // ${p.type().switch().name}
${body}`;
        }

        eventGen += `${p.doc().length > 0 ? "  // " + p.doc() : ""}
  private _${p.name()}: xdr.ScVal;
  public get ${p.name()}(): ${type} {
    ${body}
  }\n`;
      });

      const expectedLen = e.prefixTopics().length + topicParams.length;
      eventGen += `\n  constructor(e: xdr.ContractEvent) {
    const topics = e.body().value().topics();
    const data = e.body().value().data();

    // Validate topics: the first ones should match prefix topics.
    if (topics.length < ${expectedLen}) {
      throw Error(\`invalid event: too few topics (\${topics.length}), expected ${expectedLen}\`);
    }

    [this.prefix0`;
      if (e.prefixTopics().length > 1) {
        eventGen += `, this.prefix1`;
      }

      eventGen += `].forEach((t, idx) => {
      if (t !== scValToNative(topics[idx])) {
        throw Error(\`invalid event: expected "\${t}" as topic \${idx+1}\`);
      }
    });
`;
      let values: string[] = [];
      const dataFormat = xdr.ScSpecEventDataFormat;
      switch (e.dataFormat().value) {
        case dataFormat.scSpecEventDataFormatMap().value:
          values = ["scvMap", "map"];
          break;
        case dataFormat.scSpecEventDataFormatVec().value:
          values = ["scvVec", "vec"];
          break;
        case dataFormat.scSpecEventDataFormatSingleValue().value:
      }

      if (values.length == 2) {
        eventGen += `
    // Now validate the payload looks like it's described in the spec, too.
    if (data.switch().value !== xdr.ScValType.${values[0]}().value) {
      throw new Error(\`invalid event, expected ${values[1]}, got \${data.switch().name}\`);
    }\n\n`;
      }

      eventGen +=
        topicParams
          .map(
            (p, idx) =>
              `    this._${p.name()} = topics[${e.prefixTopics().length + idx}];`,
          )
          .concat(
            `
    let expectedData = [${dataParams.map((p) => `"${p.name()}"`).join(", ")}];`,
            `
    data.map()!.forEach((entry) => {
      const name = entry.key().value()?.toString() ?? "undefined";
      if (expectedData.indexOf(name) !== -1) {
        this["_" + name] = entry.val();
        expectedData = expectedData.filter(k => k !== name);
      }
    });
    if (expectedData.length > 0) {
      throw new Error(\`expected to find \${
        expectedData.map(k => \`'\${k}'\`).join(", ")
      } in event payload: \${
        JSON.stringify(
          scValToNative(data),
          (_, v) => typeof v === 'bigint' ? v.toString() : v,
          2
        )
      }\`);
    }
`,
          )
          .join("\n") + `\n  }\n}\n\n`;
    });

  writeFileSync("generated.ts", eventGen);
}

main().catch((e) => console.error(e));

function specTypeToNative(p: xdr.ScSpecTypeDef): string {
  let type: string = `any /* ${p.switch().name} */`;

  switch (p.switch().value) {
    case xdr.ScSpecType.scSpecTypeBool().value:
      type = "boolean";
      break;

    case xdr.ScSpecType.scSpecTypeU32().value:
    case xdr.ScSpecType.scSpecTypeI32().value:
      type = "number";
      break;

    case xdr.ScSpecType.scSpecTypeU64().value:
    case xdr.ScSpecType.scSpecTypeI64().value:
    case xdr.ScSpecType.scSpecTypeTimepoint().value:
    case xdr.ScSpecType.scSpecTypeDuration().value:
    case xdr.ScSpecType.scSpecTypeU128().value:
    case xdr.ScSpecType.scSpecTypeI128().value:
    case xdr.ScSpecType.scSpecTypeU256().value:
    case xdr.ScSpecType.scSpecTypeI256().value:
      type = "bigint";
      break;

    case xdr.ScSpecType.scSpecTypeAddress().value:
    case xdr.ScSpecType.scSpecTypeAddress().value:
      type = "Address";
      break;

    case xdr.ScSpecType.scSpecTypeVec().value:
      type = specTypeToNative(p.vec().elementType()) + "[]";
      break;

    case xdr.ScSpecType.scSpecTypeTuple().value:
      type = `Array<${p
        .tuple()
        .valueTypes()
        .map((t) => specTypeToNative(t))
        .join(",")}>`;
      break;

    case xdr.ScSpecType.scSpecTypeMap().value:
      type = `Record<${
        specTypeToNative(p.map().keyType())
      }, ${specTypeToNative(
        p.map().valueType(),
      )}>`;
      break;

    case xdr.ScSpecType.scSpecTypeOption().value:
      type = specTypeToNative(p.option().valueType()) + "|null";
      break;

    case xdr.ScSpecType.scSpecTypeMuxedAddress().value:
      type = "MuxedAccount";
      break;

    case xdr.ScSpecType.scSpecTypeString().value:
    case xdr.ScSpecType.scSpecTypeSymbol().value:
      type = "string";
      break;
  }

  return type;
}
