#!/usr/bin/env ruby

require 'json'
require 'httparty'

class API
  include HTTParty
  base_uri 'algoindexer.algoexplorerapi.io'

  CREATOR_ADDRESS='KANIGZX2NQKJKYJ425BWYKCT5EUHSPBRLXEJLIT2JHGTWOJ2MLYCNIVHFI'

  def assets(limit: 1000, creator: CREATOR_ADDRESS)
    cache("assets-#{creator}") do
      self.class.get('/v2/assets', query: { limit: limit, creator: creator })
    end
  end

  def transactions(asset_id, tx_type: 'acfg')
    cache("transactions-#{asset_id}") do
      self.class.get('/v2/transactions', query: { 'asset-id': asset_id, 'tx-type': tx_type })
    end
  end

  def cache(key)
    cache_dir = '.cache'
    Dir.mkdir(cache_dir, 0700) unless Dir.exist?(cache_dir)
    file_name = File.join(cache_dir, "#{key}.yml")
    if File.exist?(file_name)
      YAML.load_file(file_name)
    else
      response = yield
      File.open(file_name, 'w') { |file| file.write(response.parsed_response.to_yaml) }
      response
    end
  end
end

class Node
  attr_reader :value, :children
  attr_accessor :label, :mutant

  def initialize(value, label = nil)
    @value = value
    @label = label
    @children = []
  end

  def <<(child)
    raise "#{child.inspect} is not a Node!" unless child.is_a?(Node)
    @children << child
  end
end

class Graph
  attr_reader :nodes

  def initialize
    @nodes = []
  end

  def <<(node)
    raise "#{child.inspect} is not a Node!" unless child.is_a?(Node)
    @nodes << node
  end

  def to_dot(file, node = nil, indent: 0)
    indent_spaces = ' ' * (indent * 2)
    if node && !node.children.empty?
      # file.write("#{indent_spaces}subgraph cluster#{node.value} {\n")

      node.children.each do |child|
        color_attr = child.mutant ? ', fontcolor = "aquamarine4"' : ''
        file.write("#{indent_spaces}  #{child.value} [shape=plain, label=\"#{child.label || child.value}\"#{color_attr}];\n")
        file.write("#{indent_spaces}  #{node.value} -> #{child.value};\n")

        to_dot(file, child, indent: indent + 1)
      end

      # file.write("#{indent_spaces}}\n")
    elsif !node
      file.write("digraph kani_family_tree {\n")
      file.write("  rankdir = LR;\n")
      file.write("  compound=true;\n")
      @nodes.each do |node|
        to_dot(file, node, indent: 1)
      end
      file.write("}\n")
    end
  end

  def to_d3_json(node = nil)
    {
      name: node.label,
      children: node.children.map { |child| to_d3_json(child) }
    }
  end

  def find_node(value)
    queue = Queue.new
    @nodes.each { |c| queue.push(c) }
    while !queue.empty?
      node = queue.pop
      return node if node.value == value

      node.children.each { |c| queue.push(c) }
    end

    raise "Unknown node: #{value.inspect}"
  end
end

tree = Graph.new
root = Node.new('Original8', 'Original8')
tree.nodes << root

api = API.new
api.assets['assets'].sort_by { |a| a['params']['unit-name'].downcase }.each do |asset|
  id = asset['index'].to_s
  next if %w[394248226 394250676 394243491 394251425].include?(id)

  config = JSON.parse(Base64.decode64(api.transactions(id)['transactions'].sort_by { |t| t['round-time'] }.reverse.first['note']))

  name = config['description'].gsub(/\A\s*Kani World - /, '')
  father_id = config['properties']['Father'].to_s
  mutant = config['properties']['Mutation'] != 'False'

  father_node = tree.find_node(father_id)
  # tree.nodes << father_node = Node.new(father_id) unless father_node

  child_node = Node.new(id, name)
  child_node.mutant = mutant
  father_node << child_node
end

File.open('family_tree.json', 'w') do |file|
  file.write(tree.to_d3_json(root).to_json)
end
