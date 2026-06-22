// ==========================================================================
// AlgoLens Rendering Library
// Contains visualization components using pure SVG and DOM structures.
// Strict styling rules apply: Emerald for success/visited, Amber/Orange for active.
// ==========================================================================

const Visualizers = {
    // ----------------------------------------------------------------------
    // 1. Array Visualizer (Two Pointers, Sliding Window, Stack, Queue)
    // ----------------------------------------------------------------------
    renderArray(data, highlights, container) {
        container.innerHTML = '';
        
        const arrayContainer = document.createElement('div');
        arrayContainer.className = 'array-container';
        
        const arr = data.array || [];
        const pointers = highlights.pointers || {};
        const active = highlights.active || [];
        const success = highlights.success || [];
        const selected = highlights.selected || [];
        const windowRange = highlights.window || null; // e.g. { start: 2, end: 5 }
        
        arr.forEach((val, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'array-cell-wrapper';
            
            const cell = document.createElement('div');
            cell.className = 'array-cell';
            cell.innerText = typeof val === 'object' ? JSON.stringify(val) : val;
            
            // Apply highlighting classes
            if (active.includes(idx)) {
                cell.classList.add('highlight-active');
            } else if (success.includes(idx)) {
                cell.classList.add('highlight-success');
            } else if (selected.includes(idx)) {
                cell.classList.add('highlight-selected');
            }
            
            // Check if within sliding window range
            if (windowRange && idx >= windowRange.start && idx <= windowRange.end) {
                cell.style.borderColor = 'var(--accent-amber-light)';
                cell.style.backgroundColor = '#251b0f';
            }
            
            const indexLabel = document.createElement('span');
            indexLabel.className = 'array-index';
            indexLabel.innerText = idx;
            
            wrapper.appendChild(cell);
            wrapper.appendChild(indexLabel);
            
            // Render pointer names pointing to this index
            const pointerNames = [];
            for (const [name, val] of Object.entries(pointers)) {
                if (Number(val) === idx) {
                    pointerNames.push(name);
                }
            }
            
            if (pointerNames.length > 0) {
                const ptrLabel = document.createElement('span');
                ptrLabel.className = 'array-pointer-label';
                ptrLabel.innerText = pointerNames.join(', ');
                wrapper.appendChild(ptrLabel);
            }
            
            arrayContainer.appendChild(wrapper);
        });
        
        container.appendChild(arrayContainer);
    },

    // ----------------------------------------------------------------------
    // 2. 2D Matrix / Grid / DP Table Visualizer
    // ----------------------------------------------------------------------
    renderMatrix(data, highlights, container) {
        container.innerHTML = '';
        
        const matrix = data.matrix || [];
        if (!matrix || matrix.length === 0) {
            container.innerHTML = '<div class="empty-table-message">Empty Matrix</div>';
            return;
        }
        
        const matrixContainer = document.createElement('div');
        matrixContainer.className = 'matrix-container';
        
        const active = highlights.active || []; // e.g. [[r, c], ...]
        const visited = highlights.visited || []; // e.g. [[r, c], ...]
        const paths = highlights.paths || []; // e.g. [[r, c], ...]
        
        // Check array bounds helper
        const coordsMatch = (arr, r, c) => {
            return arr.some(coord => Array.isArray(coord) && coord[0] === r && coord[1] === c);
        };
        
        // Render Row headers optionally
        matrix.forEach((row, r) => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'matrix-row';
            
            row.forEach((val, c) => {
                const cell = document.createElement('div');
                cell.className = 'matrix-cell';
                cell.innerText = typeof val === 'object' ? JSON.stringify(val) : val;
                
                if (coordsMatch(active, r, c)) {
                    cell.classList.add('active');
                } else if (coordsMatch(paths, r, c)) {
                    cell.classList.add('path');
                } else if (coordsMatch(visited, r, c)) {
                    cell.classList.add('visited');
                }
                
                rowDiv.appendChild(cell);
            });
            
            matrixContainer.appendChild(rowDiv);
        });
        
        container.appendChild(matrixContainer);
    },

    // ----------------------------------------------------------------------
    // 3. Tree & Trie Visualizer (Binary Tree, N-ary, Trie TrieNodes)
    // ----------------------------------------------------------------------
    renderTree(data, highlights, container) {
        container.innerHTML = '';
        
        const root = data.tree;
        if (!root) {
            container.innerHTML = '<div class="empty-table-message">Empty Tree</div>';
            return;
        }

        const activeNode = highlights.active || []; // Node IDs or values
        const visitedNodes = highlights.visited || [];
        
        // SVG dimensions
        const width = 600;
        const height = 350;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.style.maxHeight = '350px';

        const nodes = [];
        const edges = [];
        
        // Helper to recursively parse binary tree or Trie / N-ary tree
        function parseTree(node, depth, xMin, xMax, parentCoord = null) {
            if (!node) return;
            
            const x = (xMin + xMax) / 2;
            const y = 40 + depth * 70;
            
            // Generate a unique ID for the node to map highlights
            const nodeId = node.id !== undefined ? String(node.id) : String(node.val !== undefined ? node.val : node.value);
            const nodeVal = node.val !== undefined ? String(node.val) : (node.value !== undefined ? String(node.value) : '?');
            
            const currentCoord = { x, y, val: nodeVal, id: nodeId };
            nodes.push(currentCoord);
            
            if (parentCoord) {
                edges.push({ from: parentCoord, to: currentCoord });
            }
            
            // Check child nodes (Binary Tree: left/right)
            if (node.left || node.right) {
                if (node.left) parseTree(node.left, depth + 1, xMin, x, currentCoord);
                if (node.right) parseTree(node.right, depth + 1, x, xMax, currentCoord);
            }
            // Check N-ary children
            else if (node.children) {
                const childrenKeys = Array.isArray(node.children) 
                    ? node.children 
                    : Object.entries(node.children).map(([k, v]) => ({ val: k, ...v })); // Handle Trie maps
                
                const len = childrenKeys.length;
                if (len > 0) {
                    const step = (xMax - xMin) / len;
                    childrenKeys.forEach((child, i) => {
                        parseTree(child, depth + 1, xMin + i * step, xMin + (i + 1) * step, currentCoord);
                    });
                }
            }
        }
        
        parseTree(root, 0, 20, width - 20);

        // Draw Edges first (so they sit below nodes)
        edges.forEach(edge => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', edge.from.x);
            line.setAttribute('y1', edge.from.y);
            line.setAttribute('x2', edge.to.x);
            line.setAttribute('y2', edge.to.y);
            line.className.baseVal = 'edge-line';
            
            // Color if traversed
            if (visitedNodes.includes(edge.to.id) && visitedNodes.includes(edge.from.id)) {
                line.classList.add('visited');
            }
            if (activeNode.includes(edge.to.id) && activeNode.includes(edge.from.id)) {
                line.classList.add('active');
            }
            
            svg.appendChild(line);
        });

        // Draw Nodes
        nodes.forEach(node => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.className.baseVal = 'tree-node-group';
            
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', node.x);
            circle.setAttribute('cy', node.y);
            circle.setAttribute('r', '18');
            circle.className.baseVal = 'node-circle';
            
            if (activeNode.includes(node.id)) {
                circle.classList.add('active');
            } else if (visitedNodes.includes(node.id)) {
                circle.classList.add('visited');
            }
            
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', node.x);
            text.setAttribute('y', node.y);
            text.className.baseVal = 'node-text';
            text.textContent = node.val;
            
            g.appendChild(circle);
            g.appendChild(text);
            svg.appendChild(g);
        });
        
        container.appendChild(svg);
    },

    // ----------------------------------------------------------------------
    // 4. Graph Visualizer (Adjacency Lists, Nodes, Traversal)
    // ----------------------------------------------------------------------
    renderGraph(data, highlights, container) {
        container.innerHTML = '';
        
        const adj = data.graph || {}; // e.g. { 0: [1, 2], 1: [2] } or standard edges list
        const keys = Object.keys(adj);
        if (keys.length === 0) {
            container.innerHTML = '<div class="empty-table-message">Empty Graph</div>';
            return;
        }

        const activeNode = highlights.active || [];
        const visitedNodes = highlights.visited || [];
        const activeEdges = highlights.edges || []; // [[u, v], ...]

        const width = 600;
        const height = 350;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.style.maxHeight = '350px';

        const center = { x: width / 2, y: height / 2 };
        const radius = Math.min(width, height) / 2 - 40;
        
        // Pre-compute circular coordinates for each node
        const coords = {};
        keys.forEach((node, idx) => {
            const angle = (idx / keys.length) * 2 * Math.PI - Math.PI / 2;
            coords[node] = {
                x: center.x + radius * Math.cos(angle),
                y: center.y + radius * Math.sin(angle)
            };
        });

        // Draw Edges
        const drawnEdges = new Set();
        keys.forEach(u => {
            const neighbors = adj[u] || [];
            neighbors.forEach(v => {
                // Ensure each edge is drawn once for undirected graphs
                const edgeKey = [u, v].sort().join('-');
                if (drawnEdges.has(edgeKey)) return;
                drawnEdges.add(edgeKey);

                if (coords[u] && coords[v]) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', coords[u].x);
                    line.setAttribute('y1', coords[u].y);
                    line.setAttribute('x2', coords[v].x);
                    line.setAttribute('y2', coords[v].y);
                    line.className.baseVal = 'edge-line';

                    // Highlight traversed or active edges
                    const isEdgeActive = activeEdges.some(e => 
                        (String(e[0]) === String(u) && String(e[1]) === String(v)) ||
                        (String(e[0]) === String(v) && String(e[1]) === String(u))
                    );
                    const isEdgeVisited = visitedNodes.includes(String(u)) && visitedNodes.includes(String(v));

                    if (isEdgeActive) {
                        line.classList.add('active');
                    } else if (isEdgeVisited) {
                        line.classList.add('visited');
                    }

                    svg.appendChild(line);
                }
            });
        });

        // Draw Nodes
        keys.forEach(node => {
            const coord = coords[node];
            if (!coord) return;

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', coord.x);
            circle.setAttribute('cy', coord.y);
            circle.setAttribute('r', '18');
            circle.className.baseVal = 'node-circle';

            if (activeNode.includes(String(node))) {
                circle.classList.add('active');
            } else if (visitedNodes.includes(String(node))) {
                circle.classList.add('visited');
            }

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', coord.x);
            text.setAttribute('y', coord.y);
            text.className.baseVal = 'node-text';
            text.textContent = node;

            g.appendChild(circle);
            g.appendChild(text);
            svg.appendChild(g);
        });

        container.appendChild(svg);
    },

    // ----------------------------------------------------------------------
    // 5. Disjoint Sets Visualizer (Union-Find Forests)
    // ----------------------------------------------------------------------
    renderDisjointSets(data, highlights, container) {
        container.innerHTML = '';
        
        const parent = data.parent || [];
        if (parent.length === 0) {
            container.innerHTML = '<div class="empty-table-message">No Disjoint Set parent array provided</div>';
            return;
        }

        // Draw union-find as a forest of trees
        // Nodes pointing to their parents.
        const width = 600;
        const height = 350;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.style.maxHeight = '350px';

        // We build paths from each node to root to determine forest tree layers.
        // Then draw parents and children in a simple structure.
        const forestRoots = new Set();
        const treeChildren = {}; // parent -> children list
        
        parent.forEach((p, i) => {
            if (p === i) {
                forestRoots.add(i);
            } else {
                if (!treeChildren[p]) treeChildren[p] = [];
                treeChildren[p].push(i);
            }
        });

        const active = highlights.active || [];
        const success = highlights.success || [];

        const nodesList = [];
        const edgeList = [];

        // Distribute roots along top/middle, then lay out child hierarchies recursively
        const rootsCount = forestRoots.size;
        const rootKeys = Array.from(forestRoots);
        const colWidth = width / (rootsCount + 1);

        function drawUnionNode(u, x, y, depth) {
            nodesList.push({ u, x, y });
            const children = treeChildren[u] || [];
            
            if (children.length > 0) {
                const childSpacing = colWidth / Math.pow(1.5, depth);
                const startX = x - ((children.length - 1) * childSpacing) / 2;
                
                children.forEach((v, idx) => {
                    const cx = startX + idx * childSpacing;
                    const cy = y + 60;
                    edgeList.push({ from: { x: cx, y: cy }, to: { x, y }, u: v, parent: u });
                    drawUnionNode(v, cx, cy, depth + 1);
                });
            }
        }

        rootKeys.forEach((root, idx) => {
            const rx = colWidth * (idx + 1);
            const ry = 60;
            drawUnionNode(root, rx, ry, 1);
        });

        // Add Marker definition for arrows pointing upwards (child -> parent)
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrow');
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '24'); // Stop arrow at edge of node circle
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto-start-reverse');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.setAttribute('fill', 'var(--border-color)');
        
        marker.appendChild(path);
        defs.appendChild(marker);
        svg.appendChild(defs);

        // Draw Union Lines with arrow markers
        edgeList.forEach(edge => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', edge.from.x);
            line.setAttribute('y1', edge.from.y);
            line.setAttribute('x2', edge.to.x);
            line.setAttribute('y2', edge.to.y);
            line.setAttribute('marker-end', 'url(#arrow)');
            line.className.baseVal = 'edge-line';

            if (active.includes(edge.u) || active.includes(edge.parent)) {
                line.classList.add('active');
            } else if (success.includes(edge.u) || success.includes(edge.parent)) {
                line.classList.add('visited');
            }

            svg.appendChild(line);
        });

        // Draw Union Nodes
        nodesList.forEach(node => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', node.x);
            circle.setAttribute('cy', node.y);
            circle.setAttribute('r', '16');
            circle.className.baseVal = 'node-circle';

            if (active.includes(node.u)) {
                circle.classList.add('active');
            } else if (success.includes(node.u)) {
                circle.classList.add('visited');
            }

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', node.x);
            text.setAttribute('y', node.y);
            text.className.baseVal = 'node-text';
            text.textContent = node.u;

            g.appendChild(circle);
            g.appendChild(text);
            svg.appendChild(g);
        });

        // Also render raw parent array at bottom for comparison
        const bottomArrayWrapper = document.createElement('div');
        bottomArrayWrapper.style.marginTop = '1rem';
        bottomArrayWrapper.style.borderTop = '1px solid var(--border-color)';
        bottomArrayWrapper.style.paddingTop = '1rem';
        bottomArrayWrapper.style.width = '100%';
        
        container.appendChild(svg);
        container.appendChild(bottomArrayWrapper);
        
        // Render raw array layout underneath Union Find Tree structures
        Visualizers.renderArray({ array: parent }, highlights, bottomArrayWrapper);
    },

    // ----------------------------------------------------------------------
    // 6. Recursion Tree / Call Stack / Backtracking Visualizer
    // ----------------------------------------------------------------------
    renderRecursionStack(data, highlights, container) {
        container.innerHTML = '';
        
        const stack = data.stack || []; // e.g. ["dfs(node=5)", "dfs(node=3)"]
        if (stack.length === 0) {
            container.innerHTML = '<div class="empty-table-message">Stack Empty</div>';
            return;
        }

        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column-reverse'; // LIFO order
        list.style.gap = '0.5rem';
        list.style.width = '100%';
        list.style.maxWidth = '380px';
        list.style.padding = '1rem';

        stack.forEach((frame, idx) => {
            const item = document.createElement('div');
            item.style.padding = '0.5rem 1rem';
            item.style.backgroundColor = idx === stack.length - 1 ? '#271e10' : 'var(--bg-element)';
            item.style.border = `1px solid ${idx === stack.length - 1 ? 'var(--accent-amber-light)' : 'var(--border-color)'}`;
            item.style.borderRadius = 'var(--radius-sm)';
            item.style.fontFamily = 'var(--font-mono)';
            item.style.fontSize = '0.8rem';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.color = idx === stack.length - 1 ? '#ffffff' : 'var(--text-primary)';
            
            const frameText = document.createElement('span');
            frameText.innerText = frame;
            
            const frameDepth = document.createElement('span');
            frameDepth.style.color = 'var(--text-muted)';
            frameDepth.innerText = `[Depth ${idx}]`;
            
            item.appendChild(frameText);
            item.appendChild(frameDepth);
            list.appendChild(item);
        });

        container.appendChild(list);
    },

    // ----------------------------------------------------------------------
    // Master Route Renderer
    // Reads `visuals` metadata and triggers the appropriate component.
    // ----------------------------------------------------------------------
    draw(visuals, container) {
        if (!visuals || !visuals.type) {
            container.innerHTML = '<div class="empty-table-message">No visual mapping information provided for this step</div>';
            return;
        }

        const type = visuals.type;
        const data = visuals.data || {};
        const highlights = visuals.highlights || {};

        switch (type) {
            case 'array':
                this.renderArray(data, highlights, container);
                break;
            case 'matrix':
            case 'grid':
            case 'dp':
                this.renderMatrix(data, highlights, container);
                break;
            case 'tree':
            case 'trie':
                this.renderTree(data, highlights, container);
                break;
            case 'graph':
                this.renderGraph(data, highlights, container);
                break;
            case 'disjoint-set':
            case 'union-find':
                this.renderDisjointSets(data, highlights, container);
                break;
            case 'recursion':
            case 'stack':
            case 'backtracking':
                this.renderRecursionStack(data, highlights, container);
                break;
            default:
                container.innerHTML = `<div class="empty-table-message">Unsupported visualization type: ${type}</div>`;
        }
    }
};
