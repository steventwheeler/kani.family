'use strict'

export default class Graph {
  graph = [];
  constructor() {

  }

  /**
   * Add a new root node to the graph.
   * @param {object} node The new root node
   */
  addRoot(node) {
    this.graph.push(node);
  }

  /**
   * Retrieve a node from the graph based on the value of its `id`
   * attribute. If no matching node is found then an exception will be
   * thrown.
   * @param {string} id The id of the node to locate
   * @returns {object} The node, if it exists
   */
  findById(id) {
    const queue = []
    queue.push(...this.graph);
    while (queue.length > 0) {
      var node = queue.shift();
      if (node.id === id) return node;

      if (node.children) queue.push(...node.children);
    }

    throw "Unknown node: " + id;
  }

  /**
   * Caculate the height of the provided node in the graph.
   * @param {object} node The node to check
   * @returns {number} The height of the node
   **/
  height(node) {
    var max = 0;
    for (var i = 0; i < node.children.length; i++) {
      max = Math.max(max, this.height(node.children[i]));
    }
    return max + 1;
  }

  descendants(node) {
    if (!node.children) return 0;

    var count = node.children.length;
    for (var i = 0; i < node.children.length; i++) {
      count += this.descendants(node.children[i]);
    }
    return count;
  }
}
