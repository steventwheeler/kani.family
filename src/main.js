'use strict';

import * as IPFS from "ipfs-core";
import loadKani from "./kani_loader.js";
import familyTree from "./family_tree.js";
import kaniList from "./kani_list.js";

$(document).ready(e => {
  console.log("Loading data...");
  loadKani(IPFS.create())
    .then(kaniData => {
      activateView(urlView(), kaniData);

      $(window).on('hashchange', () => activateView(urlView(), kaniData));
    });
});


function urlView() {
  var hash = window.location.hash;
  switch (window.location.hash) {
    case "#kani-list": return "kani-list";
    default:            return "family-tree";
  }
}

function activateView(view, kaniData) {
  $("#content").text("Loading data...");
  $(".nav-link").removeClass("active");
  $(".nav-link[href='#" + view + "']").addClass("active");

  switch (view) {
    case "kani-list":
      console.log("Starting kaniList...")
      kaniList(kaniData)
      break;
    default:
      console.log("Starting familyTree...")
      familyTree(kaniData);
      break;
  }
}
