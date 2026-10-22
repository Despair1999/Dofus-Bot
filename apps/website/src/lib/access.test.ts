import { test } from "node:test";
import { strict as assert } from "node:assert";
import { pbkdf2Sync } from "node:crypto";
import { verifyPreviewPassword, isAccessConfig, type AccessConfig } from "./access";

const password = "sample-local-testing-passphrase-12";
const salt = "8bbdc4296a7c5f124ec2ae3686cf90d3";
const config: AccessConfig = {
  version:1,scheme:"pbkdf2-sha256",iterations:200000,salt,
  verifier:pbkdf2Sync(password, Buffer.from(salt,"hex"),200000,32,"sha256").toString("hex"),
};
test("accepts the right passphrase",async()=>assert.equal(await verifyPreviewPassword(password,config),true));
test("rejects wrong passwords and empty passwords",async()=>{
  assert.equal(await verifyPreviewPassword("wrong",config),false);
  assert.equal(await verifyPreviewPassword("",config),false);
});
test("rejects corrupt or weak access configurations",()=>{
  assert.equal(isAccessConfig({...config,iterations:100}),false);
  assert.equal(isAccessConfig({...config,verifier:"not-a-verifier"}),false);
  assert.equal(isAccessConfig(config),true);
});
