'use strict';

import Algorand from "./algorand.js";

const algorandClient = new Algorand();

function rank(value, mid) {
  return parseInt(value) - mid;
}

function intWithSign(i) {
  return (i < 0 ?"":"+") + i;
}

function attributeRankSpan(value, rank) {
  var title = "This attribute is " + (rank == 0?"equal to":(Math.abs(rank) + " buffs " + (rank < 0?"below":"above"))) + " the median value.";
  return "<span class='attribute' title='" + title + "'>" + value + "<sup class='rank'>" + intWithSign(rank) + "</sup></span>"
}

function mutationResult(mutation) {
  switch (mutation) {
    case "False":         return "";
    case "Power Claw":    return "+3 Power";
    case "Weak Claw":     return "-3 Power";
    case "Grippy Claw":   return "+3 Wrestle";
    case "Slippery Claw": return "-3 Wrestle";
    case "Spotted Claw":  return "+3 Appeal";
    case "Plain Claw":    return "-3 Appeal";
    default:              return "Unknown";
  }
}

function mutationBackground(mutation) {
  switch (mutation) {
    case "False":         return "";
    case "Power Claw":    return "success";
    case "Weak Claw":     return "warning";
    case "Grippy Claw":   return "success";
    case "Slippery Claw": return "warning";
    case "Spotted Claw":  return "success";
    case "Plain Claw":    return "warning";
    default:              return "";
  }
}

function nftExplorerLink(id, text) {
  if (!text) text = id;
  return "<a href='https://www.nftexplorer.app/asset/" + id + "' title='View on NFT Explorer' target='_blank'>" + text + "</a>";
}

function parentLink(data, parentId) {
  if (parentId == "Original8") return "";

  var name = parentId;
  var parent = data.find(e => e.id == parentId);
  if (parent) name = parent.name;
  return nftExplorerLink(parentId, name);
}

function countChildren(data, parentId) {
  return data.filter(e => e["metadata"]["properties"]["Mother"] == parentId || e["metadata"]["properties"]["Father"] == parentId).length;
}

function rankBackground(rank, max) {
  var red = new Color("#dc3545");
  var white = new Color("white");
  var green = new Color("#28a745");
  var gradient = white.range(rank >= 0?green:red);
  return gradient(Math.abs(rank) / (max * 1.25)).to("sRGB").toString();
}

function specialMoveAttribute(move) {
  switch (move) {
    case "Claw Crush":   return "Power";
    case "Crab Grab":    return "Wrestle";
    case "Shell Quake":  return "Stamina";
    case "Shell Shine":  return "Appeal";
    case "Rapid Strike": return "Speed";
    default: return "Unknown";
  }
}

function specialMoveBackground(kani) {

  var attributes = ["power", "wrestle", "stamina", "appeal", "speed"];
  var bestAttribute = attributes.sort((a, b) => -1 * (parseInt(kani.ranks[a]) - parseInt(kani.ranks[b])))[0];
  var specialMoveAttr = specialMoveAttribute(kani["metadata"]["properties"]["Special Move"]);
  if (bestAttribute == specialMoveAttr.toLowerCase()) return "";

  return "warning";
}

function drawTable(data, fullDataset) {
  if (!fullDataset) fullDataset = data;

  // Remove the loading text.
  $("#content").empty();

  // Initialize the table view.
  var table = d3.select("#content")
    .append("table")
    .attr("class", "mykani");

  var columns = [
    { head: "Unit", html: k => k["asset"]["params"]["unit-name"] },
    { head: "Asset ID", html: k => nftExplorerLink(k.id) },
    { head: "Name", html: k => "<span title='" + k.metadata.description  + "'>" + k.name + "</span>" },
    // { head: "Image", html: k => {} },
    { head: "Power", bg: k => k.rankColors.power, html: k => attributeRankSpan(k.power, k.ranks.power) },
    { head: "Wrestle", bg: k => k.rankColors.wrestle, html: k => attributeRankSpan(k.wrestle, k.ranks.wrestle) },
    { head: "Stamina", bg: k => k.rankColors.stamina, html: k => attributeRankSpan(k.stamina, k.ranks.stamina) },
    { head: "Appeal", bg: k => k.rankColors.appeal, html: k => attributeRankSpan(k.appeal, k.ranks.appeal) },
    { head: "Speed", bg: k => k.rankColors.speed, html: k => attributeRankSpan(k.speed, k.ranks.speed) },
    { head: "Fight Rank", html: k => intWithSign(k.ranks.power + k.ranks.wrestle + k.ranks.stamina) },
    { head: "Total Rank", html: k => intWithSign(k.ranks.power + k.ranks.wrestle + k.ranks.stamina + k.ranks.appeal + k.ranks.speed) },
    { head: "Special Move", html: k => k["metadata"]["properties"]["Special Move"] },
    { head: "Special Move Attr", cl: k => specialMoveBackground(k), html: k => specialMoveAttribute(k["metadata"]["properties"]["Special Move"]) },
    { head: "Region", html: k => k["metadata"]["properties"]["Region"] },
    { head: "Power Bonus", html: k => k["metadata"]["properties"]["Power Bonus"] },
    { head: "Wrestle Bonus", html: k => k["metadata"]["properties"]["Wrestle Bonus"] },
    { head: "Mutation", cl: k => mutationBackground(k.mutation), html: k => k.mutation == "False"?"":"<span title='" + mutationResult(k.mutation) + "'>" + k.mutation + "</span>" },
    { head: "Mother", html: k => parentLink(fullDataset, k["metadata"]["properties"]["Mother"]) },
    { head: "Father", html: k => parentLink(fullDataset, k["metadata"]["properties"]["Father"]) },
    { head: "Highlights", html: k => k["metadata"]["properties"]["Highlights"] },
    { head: "Background", html: k => k["metadata"]["properties"]["Background"] },
    { head: "Children", html: k => countChildren(fullDataset, k.id) },
  ];
  table.append("thead")
    .selectAll("th")
    .data(columns)
    .enter()
    .append("th")
    .attr("class", c => c.cl)
    .text(c => c.head);
  table.append("tbody")
    .selectAll("tr")
    .data(data)
    .enter()
    .append("tr")
    .selectAll("td")
    .data((row, i) => {
      return columns.map(c => {
        var cell = {};
        Object.keys(c).forEach(k => {
          cell[k] = typeof c[k] == "function" ? c[k](row, i) : c[k];
        });
        return cell;
      });
    })
    .enter()
    .append("td")
    .html(c => c.html)
    .attr("class", c => c.cl)
    .style("background-color", c => c.bg);
}

export default function kaniList(data) {
    // Compute ranks.
    data.forEach(k => {
      k["power"] = k["metadata"]["properties"]["Power"];
      k["wrestle"] = k["metadata"]["properties"]["Wrestle"];
      k["stamina"] = k["metadata"]["properties"]["Stamina"];
      k["appeal"] = k["metadata"]["properties"]["Appeal"];
      k["speed"] = k["metadata"]["properties"]["Speed"];
      k["mutation"] = k["metadata"]["properties"]["Mutation"];
      k["ranks"] = {
        power: rank(k.power, 10),
        wrestle: rank(k.wrestle, 10),
        stamina: rank(k.stamina, 10),
        appeal: rank(k.appeal, 10),
        speed: rank(k.speed, 15)
      };
    });
    data.forEach(k => {
      k["rankColors"] = {
        power: rankBackground(k.ranks.power, Math.max(...data.map(k2 => k2.ranks.power))),
        wrestle: rankBackground(k.ranks.wrestle, Math.max(...data.map(k2 => k2.ranks.wrestle))),
        stamina: rankBackground(k.ranks.stamina, Math.max(...data.map(k2 => k2.ranks.stamina))),
        appeal: rankBackground(k.ranks.appeal, Math.max(...data.map(k2 => k2.ranks.appeal))),
        speed: rankBackground(k.ranks.speed, Math.max(...data.map(k2 => k2.ranks.speed))),
      };
    });

    drawTable(data);

    // Enable the search input.
    $('#owner-address-search [disabled]').prop("disabled", false);

    // Handle wallet address changes.
    $('#owner-address-search').on('submit', event => {
      if ($("#content table").length < 1) return;

      event.preventDefault();
      event.stopPropagation();
      var form = $("#owner-address-search");
      var input = $("#owner-address");
      var feedback = $("#owner-address-validation-feedback");
      var address = input.val();

      if (address == "") {
        drawTable(data);
        return;
      }

      algorandClient.getAccountAssets(address)
        .then(assets => {
          var ownedAssets = [];
          for (var i = 0; i < assets.length; i++) {
            var asset = assets[i];
            if (asset.amount <= 0) continue;

            ownedAssets.push(String(asset['asset-id']));
          }
          input.removeClass('is-invalid');
          input.addClass('is-valid');
          feedback.text('');

          drawTable(data.filter(kani => ownedAssets.includes(kani.id)), data);
        })
        .catch(e => {
          input.removeClass('is-valid');
          input.addClass('is-invalid');
          feedback.text(e);
          drawTable(data);
          drawGraph(root);
        });

      return false;
    });
}
