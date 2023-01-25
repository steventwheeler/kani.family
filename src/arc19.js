"use strict"

import algosdk from "algosdk";
import * as mfsha2 from "multiformats/hashes/sha2";
import * as digest from "multiformats/hashes/digest";
import { CID } from "multiformats/cid";

export default class ARC19 {
  static REGEX = "template-ipfs://{ipfscid:(?<version>[01]):(?<codec>[a-z0-9\-]+):(?<field>[a-z0-9\-]+):(?<hash>[a-z0-9\-]+)}";
  static parse(url, reserveAddress) {
    var cid = ARC19.parseCID(url, reserveAddress);
    var ipfsUrl = "ipfs://" + cid.toString();
    // console.log("IPFS URL: " + ipfsUrl);
    return ipfsUrl;
  }

  static parseCID(url, reserveAddress) {
    // console.log("Parsing ARC19 template-ipfs: URL='" + url + "', reserve address='" + reserveAddress + "'.");
    var matches = url.match(ARC19.REGEX);
    if (!matches) {
      if (url.startsWith("template-ipfs://")) throw "unsupported template-ipfs spec";

      return url;
    }

    const version = parseInt(matches.groups.version);
    const codec = matches.groups.codec;
    const field = matches.groups.field;
    const hash = matches.groups.hash;

    if (field != "reserve") throw "unsupported ipfscid field '" + field + "', only reserve is currently supported";

    var codecId;
    switch (codec) {
      case "raw":
        codecId = 0x55;
        break;
      case "dag-pb":
        codecId = 0x70;
        break;
      default:
        throw "unknown multicodec type '" + codec + "' in ipfscid spec";
    }

    const address = algosdk.decodeAddress(reserveAddress);

    var mhdigest;
    switch (hash) {
      case "sha2-256":
        mhdigest = digest.create(mfsha2.sha256.code, address.publicKey);
        break;
      default:
        throw "unknown hash type '" + hash + "' in ipfscid spec"
    }

    if (version == 0) {
      if (codec != 'dag-pb' || hash != "sha2-256") throw "cid v0 must always be dag-pb and sha2-256 codec/hash type";
      return CID.createV0(mhdigest);
    } else {
      return CID.createV1(codecId, mhdigest);
    }
  }
}
