import { useCallback, useEffect, useMemo, useState, type DragEvent as ReactDragEvent } from "react"
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

type Point = { x: number; y: number }
export type FlowNode = { id: string; type: string; title: string; description: string; position?: Point }
export type FlowEdge = { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null; label?: string }
type NodeMeta = { type: string; title: string; description: string; mark: string }

type Props = {
  nodes: FlowNode[]
  edges?: FlowEdge[]
  modelType?: string
  onChange: (nodes: FlowNode[], edges: FlowEdge[]) => void
}

const nodeTypesMeta: NodeMeta[] = [
  { type: "interaction", title: "交互", description: "人与本模型进行输入、确认或办理交互", mark: "交" },
  { type: "read", title: "读取", description: "读取数字化库、配置数字化库或前序模型数据", mark: "读" },
  { type: "parameter", title: "参数", description: "定义本模型运行期间使用的临时参数", mark: "参" },
  { type: "calculation", title: "运算", description: "计算、匹配、转换或聚合数据", mark: "算" },
  { type: "condition", title: "判断", description: "按条件形成是/否两条运行分支", mark: "判" },
  { type: "output", title: "输出存储", description: "形成模型结果并归档到本模型数字化库", mark: "存" },
]

const uid = (prefix = "node") => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const metaOf = (type: string) => nodeTypesMeta.find(item => item.type === type) ?? nodeTypesMeta[0]
const defaultPosition = (index: number): Point => ({ x: 80 + (index % 4) * 235, y: 80 + Math.floor(index / 4) * 170 })

function ModelNode({ data, selected }: NodeProps<Node<{ title: string; description: string; nodeType: string; mark: string }>>) {
  const meta = metaOf(String(data.nodeType))
  const isCondition = data.nodeType === "condition"
  return <div className={`rf-business-node type-${data.nodeType} ${selected ? "selected" : ""}`}>
    <Handle type="target" position={Position.Left} id="in" className="rf-handle"/>
    <div className="rf-business-head"><i>{data.mark}</i><span>{meta.title}</span></div>
    <b>{data.title || meta.title}</b>
    <p>{data.description || meta.description}</p>
    {isCondition ? <div className="rf-branches"><span>是</span><span>否</span></div> : null}
    {isCondition ? <><Handle type="source" position={Position.Right} id="true" className="rf-handle true" style={{ top: "42%" }}/><Handle type="source" position={Position.Right} id="false" className="rf-handle false" style={{ top: "72%" }}/></> : <Handle type="source" position={Position.Right} id="out" className="rf-handle"/>}
  </div>
}

const rfNodeTypes = { business: ModelNode }

function buildInitialEdges(nodes: FlowNode[], supplied?: FlowEdge[]): FlowEdge[] {
  if (supplied?.length) return supplied
  if (nodes.length < 2) return []
  return nodes.slice(0, -1).map((node, index) => ({ id: `edge-${node.id}-${nodes[index + 1].id}`, source: node.id, target: nodes[index + 1].id, sourceHandle: node.type === "condition" ? "true" : "out", targetHandle: "in", label: node.type === "condition" ? "是" : undefined }))
}

function toRfNodes(items: FlowNode[]): Node[] {
  return items.filter(item => item.type !== "approval").map((item, index) => {
    const meta = metaOf(item.type)
    return { id: item.id, type: "business", position: item.position ?? defaultPosition(index), data: { title: item.title, description: item.description, nodeType: item.type, mark: meta.mark } }
  })
}

function toRfEdges(items: FlowEdge[], validNodeIds?: Set<string>): Edge[] {
  const filtered = validNodeIds ? items.filter(item => validNodeIds.has(item.source) && validNodeIds.has(item.target)) : items
  return filtered.map(item => ({ ...item, type: "smoothstep", animated: false, markerEnd: { type: MarkerType.ArrowClosed }, label: item.label, style: { strokeWidth: 1.7 } }))
}

function serializeNodes(rfNodes: Node[], current: FlowNode[]): FlowNode[] {
  const map = new Map(current.map(item => [item.id, item]))
  return rfNodes.map(node => {
    const old = map.get(node.id)
    return { id: node.id, type: String(node.data.nodeType ?? old?.type ?? "interaction"), title: String(node.data.title ?? old?.title ?? "节点"), description: String(node.data.description ?? old?.description ?? ""), position: { x: Math.round(node.position.x), y: Math.round(node.position.y) } }
  }).sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0) || (a.position?.x ?? 0) - (b.position?.x ?? 0))
}

function serializeEdges(rfEdges: Edge[]): FlowEdge[] {
  return rfEdges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle, label: typeof edge.label === "string" ? edge.label : undefined }))
}

export function ModelFlowDesigner(props: Props) {
  return <ReactFlowProvider><FlowDesignerInner {...props}/></ReactFlowProvider>
}

function FlowDesignerInner({ nodes: modelNodes, edges: modelEdges, modelType = "business", onChange }: Props) {
  const cleanedNodes = useMemo(() => modelNodes.filter(item => item.type !== "approval"), [modelNodes])
  const validIds = useMemo(() => new Set(cleanedNodes.map(item => item.id)), [cleanedNodes])
  const initialEdges = useMemo(() => buildInitialEdges(cleanedNodes, modelEdges).filter(edge => validIds.has(edge.source) && validIds.has(edge.target)), [])
  const [nodes, setNodes, onNodesChange] = useNodesState(toRfNodes(cleanedNodes))
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRfEdges(initialEdges))
  const [selectedNodeId, setSelectedNodeId] = useState(cleanedNodes[0]?.id ?? "")
  const [selectedEdgeId, setSelectedEdgeId] = useState("")
  const { screenToFlowPosition, fitView } = useReactFlow()
  const selectedNode = nodes.find(item => item.id === selectedNodeId)
  const selectedEdge = edges.find(item => item.id === selectedEdgeId)
  const modelTypeTitle = modelType === "approval" ? "审批模型" : modelType === "smart" ? "智选模型" : modelType === "service" ? "服务模型" : "业务模型"

  useEffect(() => {
    const nextModelNodes = modelNodes.filter(item => item.type !== "approval")
    const ids = new Set(nextModelNodes.map(item => item.id))
    const nextEdges = buildInitialEdges(nextModelNodes, modelEdges).filter(edge => ids.has(edge.source) && ids.has(edge.target))
    setNodes(toRfNodes(nextModelNodes))
    setEdges(toRfEdges(nextEdges))
    if (!nextModelNodes.some(item => item.id === selectedNodeId)) setSelectedNodeId(nextModelNodes[0]?.id ?? "")
  }, [modelNodes, modelEdges])

  const commit = useCallback((nextNodes = nodes, nextEdges = edges) => {
    onChange(serializeNodes(nextNodes, modelNodes), serializeEdges(nextEdges))
  }, [nodes, edges, modelNodes, onChange])

  const addNode = (type: string, position?: Point) => {
    const meta = metaOf(type)
    const id = uid()
    const next: Node = { id, type: "business", position: position ?? defaultPosition(nodes.length), data: { title: meta.title, description: meta.description, nodeType: type, mark: meta.mark } }
    const nextNodes = [...nodes, next]
    setNodes(nextNodes); setSelectedNodeId(id); setSelectedEdgeId(""); commit(nextNodes, edges)
  }

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return
    const source = nodes.find(item => item.id === connection.source)
    const defaultLabel = source?.data.nodeType === "condition" ? (connection.sourceHandle === "false" ? "否" : "是") : undefined
    setEdges(current => {
      const withoutSameHandle = current.filter(edge => !(edge.source === connection.source && edge.sourceHandle === connection.sourceHandle))
      const next = addEdge({ ...connection, id: uid("edge"), type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed }, label: defaultLabel }, withoutSameHandle)
      queueMicrotask(() => commit(nodes, next))
      return next
    })
  }, [nodes, commit, setEdges])

  const isValidConnection = useCallback((connection: Edge | Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return false
    if (edges.some(edge => edge.source === connection.source && edge.target === connection.target && edge.sourceHandle === connection.sourceHandle)) return false
    const source = nodes.find(item => item.id === connection.source)
    if (source?.data.nodeType !== "condition") return !edges.some(edge => edge.source === connection.source)
    return !edges.some(edge => edge.source === connection.source && edge.sourceHandle === connection.sourceHandle)
  }, [edges, nodes])

  const onDrop = (event: ReactDragEvent) => {
    event.preventDefault()
    const type = event.dataTransfer.getData("model/node-type")
    if (!type || type === "approval") return
    addNode(type, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }

  const updateNode = (patch: Partial<{ nodeType: string; title: string; description: string }>) => {
    if (!selectedNode) return
    const nextNodes = nodes.map(node => node.id === selectedNode.id ? { ...node, data: { ...node.data, ...patch, mark: patch.nodeType ? metaOf(patch.nodeType).mark : node.data.mark } } : node)
    setNodes(nextNodes); commit(nextNodes, edges)
  }

  const removeSelectedNode = () => {
    if (!selectedNode) return
    const nextNodes = nodes.filter(node => node.id !== selectedNode.id)
    const nextEdges = edges.filter(edge => edge.source !== selectedNode.id && edge.target !== selectedNode.id)
    setNodes(nextNodes); setEdges(nextEdges); setSelectedNodeId(nextNodes[0]?.id ?? ""); commit(nextNodes, nextEdges)
  }

  const updateEdge = (label: string) => {
    if (!selectedEdge) return
    const next = edges.map(edge => edge.id === selectedEdge.id ? { ...edge, label } : edge)
    setEdges(next); commit(nodes, next)
  }

  const removeSelectedEdge = () => {
    if (!selectedEdge) return
    const next = edges.filter(edge => edge.id !== selectedEdge.id)
    setEdges(next); setSelectedEdgeId(""); commit(nodes, next)
  }

  return <div className="mfd-shell mfd-reactflow">
    <div className="mfd-head"><div><b>{modelTypeTitle}运行结构 · 自由连线</b><span>节点只描述“当前独立模型内部如何运行”。审批、智选、会议等都是独立模型，不作为其他模型的业务节点；模型之间的衔接在第 4 阶段配置。</span></div><em>{nodes.length} 个节点 · {edges.length} 条连线</em></div>
    <div className="mfd-body">
      <aside className="mfd-palette"><h5>通用运行节点</h5>{nodeTypesMeta.map(meta => <button key={meta.type} draggable onDragStart={event => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("model/node-type", meta.type) }} onClick={() => addNode(meta.type)}><i>{meta.mark}</i><span><b>{meta.title}</b><small>{meta.description}</small></span><em>＋</em></button>)}<div className="mfd-palette-tip"><b>模型关系不放在节点库</b><span>“请休假 → 审批 → 智选 → 会议模型”等跨模型关系全部在各模型第 4 阶段“配置”中设置。</span></div></aside>
      <section className="mfd-workspace rf-workspace" onDrop={onDrop} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy" }}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={rfNodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeDragStop={(_, dragged) => { const next = nodes.map(node => node.id === dragged.id ? { ...node, position: dragged.position } : node); setNodes(next); commit(next, edges) }} onNodesDelete={deleted => { const deletedIds = new Set(deleted.map(node => node.id)); const nextNodes = nodes.filter(node => !deletedIds.has(node.id)); const nextEdges = edges.filter(edge => !deletedIds.has(edge.source) && !deletedIds.has(edge.target)); setNodes(nextNodes); setEdges(nextEdges); commit(nextNodes, nextEdges) }} onEdgesDelete={deleted => { const ids = new Set(deleted.map(edge => edge.id)); const next = edges.filter(edge => !ids.has(edge.id)); setEdges(next); commit(nodes, next) }} onConnect={onConnect} isValidConnection={isValidConnection} onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId("") }} onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId("") }} onPaneClick={() => { setSelectedNodeId(""); setSelectedEdgeId("") }} fitView fitViewOptions={{ padding: 0.25 }} minZoom={0.35} maxZoom={1.8} deleteKeyCode={["Backspace", "Delete"]} proOptions={{ hideAttribution: false }}>
          <Background gap={18} size={1}/><MiniMap pannable zoomable/><Controls showInteractive={false}/>
        </ReactFlow>
        <div className="rf-toolbar"><button type="button" onClick={() => void fitView({ padding: 0.25, duration: 250 })}>适应画布</button><span>连线规则：普通节点 1 条出口；判断节点“是/否”各 1 条出口</span></div>
      </section>
      <aside className="mfd-inspector">{selectedNode ? <><h5>节点属性</h5><label>节点类型<select value={String(selectedNode.data.nodeType)} onChange={event => { const meta = metaOf(event.target.value); updateNode({ nodeType: event.target.value, title: meta.title, description: meta.description }) }}>{nodeTypesMeta.map(meta => <option key={meta.type} value={meta.type}>{meta.title}</option>)}</select></label><label>节点名称<input value={String(selectedNode.data.title ?? "")} onChange={event => updateNode({ title: event.target.value })}/></label><label>节点说明<textarea rows={5} value={String(selectedNode.data.description ?? "")} onChange={event => updateNode({ description: event.target.value })}/></label><div className="mfd-inspector-note"><b>坐标</b><span>X {Math.round(selectedNode.position.x)} · Y {Math.round(selectedNode.position.y)}</span></div><button className="danger" onClick={removeSelectedNode}>删除当前节点</button></> : selectedEdge ? <><h5>连线属性</h5><div className="mfd-inspector-note"><b>连接</b><span>{selectedEdge.source} → {selectedEdge.target}</span></div><label>分支/连线名称<input value={typeof selectedEdge.label === "string" ? selectedEdge.label : ""} onChange={event => updateEdge(event.target.value)} placeholder="例如：是 / 否 / 金额≥100万"/></label><button className="danger" onClick={removeSelectedEdge}>删除当前连线</button></> : <div className="mfd-no-selection"><b>选择节点或连线</b><span>点击画布元素后编辑属性；从节点右侧圆点拖向目标节点左侧圆点即可连线。</span></div>}</aside>
    </div>
  </div>
}
