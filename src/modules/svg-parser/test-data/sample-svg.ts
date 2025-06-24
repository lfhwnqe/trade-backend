/**
 * 测试用的SVG样本数据
 */

export const SIMPLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <rect id="node1" x="50" y="50" width="100" height="60" fill="#ff6b6b" stroke="#333" stroke-width="2"/>
  <text x="100" y="85" text-anchor="middle" font-family="Arial" font-size="14">节点1</text>
  
  <rect id="node2" x="250" y="50" width="100" height="60" fill="#4ecdc4" stroke="#333" stroke-width="2"/>
  <text x="300" y="85" text-anchor="middle" font-family="Arial" font-size="14">节点2</text>
  
  <rect id="node3" x="150" y="180" width="100" height="60" fill="#45b7d1" stroke="#333" stroke-width="2"/>
  <text x="200" y="215" text-anchor="middle" font-family="Arial" font-size="14">节点3</text>
  
  <line id="edge1" x1="150" y1="80" x2="250" y2="80" stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>
  <line id="edge2" x1="100" y1="110" x2="200" y2="180" stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>
  <line id="edge3" x1="300" y1="110" x2="200" y2="180" stroke="#333" stroke-width="2" marker-end="url(#arrowhead)"/>
  
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#333"/>
    </marker>
  </defs>
</svg>
`;

export const COMPLEX_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <!-- 中心节点 -->
  <circle id="center" cx="400" cy="300" r="40" fill="#ff6b6b" stroke="#333" stroke-width="3"/>
  <text x="400" y="305" text-anchor="middle" font-family="Arial" font-size="12" fill="white">中心</text>
  
  <!-- 分支节点 -->
  <rect id="branch1" x="200" y="150" width="80" height="50" fill="#4ecdc4" stroke="#333" stroke-width="2" rx="5"/>
  <text x="240" y="180" text-anchor="middle" font-family="Arial" font-size="11">分支1</text>
  
  <ellipse id="branch2" cx="600" cy="200" rx="50" ry="30" fill="#45b7d1" stroke="#333" stroke-width="2"/>
  <text x="600" y="205" text-anchor="middle" font-family="Arial" font-size="11">分支2</text>
  
  <polygon id="branch3" points="150,400 200,380 250,400 200,420" fill="#f7dc6f" stroke="#333" stroke-width="2"/>
  <text x="200" y="405" text-anchor="middle" font-family="Arial" font-size="11">分支3</text>
  
  <rect id="branch4" x="500" y="450" width="80" height="50" fill="#bb8fce" stroke="#333" stroke-width="2" rx="5"/>
  <text x="540" y="480" text-anchor="middle" font-family="Arial" font-size="11">分支4</text>
  
  <!-- 子节点 -->
  <circle id="sub1" cx="120" cy="100" r="25" fill="#ffeaa7" stroke="#333" stroke-width="1"/>
  <text x="120" y="105" text-anchor="middle" font-family="Arial" font-size="10">子1</text>
  
  <circle id="sub2" cx="320" cy="100" r="25" fill="#ffeaa7" stroke="#333" stroke-width="1"/>
  <text x="320" y="105" text-anchor="middle" font-family="Arial" font-size="10">子2</text>
  
  <circle id="sub3" cx="700" cy="120" r="25" fill="#ffeaa7" stroke="#333" stroke-width="1"/>
  <text x="700" y="125" text-anchor="middle" font-family="Arial" font-size="10">子3</text>
  
  <!-- 连接线 -->
  <path id="conn1" d="M 360 300 Q 280 225 240 200" stroke="#333" stroke-width="2" fill="none" marker-end="url(#arrow)"/>
  <path id="conn2" d="M 440 300 Q 520 250 550 200" stroke="#333" stroke-width="2" fill="none" marker-end="url(#arrow)"/>
  <path id="conn3" d="M 360 300 Q 280 350 225 400" stroke="#333" stroke-width="2" fill="none" marker-end="url(#arrow)"/>
  <path id="conn4" d="M 440 300 Q 470 375 540 450" stroke="#333" stroke-width="2" fill="none" marker-end="url(#arrow)"/>
  
  <line id="conn5" x1="200" y1="175" x2="145" y2="125" stroke="#666" stroke-width="1" stroke-dasharray="5,5"/>
  <line id="conn6" x1="280" y1="175" x2="320" y2="125" stroke="#666" stroke-width="1" stroke-dasharray="5,5"/>
  <line id="conn7" x1="650" y1="200" x2="700" y2="145" stroke="#666" stroke-width="1" stroke-dasharray="5,5"/>
  
  <!-- 标记定义 -->
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#333"/>
    </marker>
  </defs>
</svg>
`;

export const WHIMSICAL_STYLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700">
  <!-- 主题节点 -->
  <g id="main-topic" transform="translate(500,350)">
    <rect x="-80" y="-30" width="160" height="60" fill="#ff6b6b" stroke="#333" stroke-width="3" rx="30"/>
    <text x="0" y="5" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="white">主题</text>
  </g>
  
  <!-- 一级分支 -->
  <g id="branch-1" transform="translate(200,200)">
    <rect x="-60" y="-25" width="120" height="50" fill="#4ecdc4" stroke="#333" stroke-width="2" rx="25"/>
    <text x="0" y="5" text-anchor="middle" font-family="Arial" font-size="14" fill="white">想法1</text>
  </g>
  
  <g id="branch-2" transform="translate(800,200)">
    <rect x="-60" y="-25" width="120" height="50" fill="#45b7d1" stroke="#333" stroke-width="2" rx="25"/>
    <text x="0" y="5" text-anchor="middle" font-family="Arial" font-size="14" fill="white">想法2</text>
  </g>
  
  <g id="branch-3" transform="translate(200,500)">
    <rect x="-60" y="-25" width="120" height="50" fill="#f7dc6f" stroke="#333" stroke-width="2" rx="25"/>
    <text x="0" y="5" text-anchor="middle" font-family="Arial" font-size="14">想法3</text>
  </g>
  
  <g id="branch-4" transform="translate(800,500)">
    <rect x="-60" y="-25" width="120" height="50" fill="#bb8fce" stroke="#333" stroke-width="2" rx="25"/>
    <text x="0" y="5" text-anchor="middle" font-family="Arial" font-size="14" fill="white">想法4</text>
  </g>
  
  <!-- 二级分支 -->
  <g id="sub-1-1" transform="translate(50,150)">
    <ellipse cx="0" cy="0" rx="40" ry="20" fill="#ffeaa7" stroke="#333" stroke-width="1"/>
    <text x="0" y="5" text-anchor="middle" font-family="Arial" font-size="12">细节1</text>
  </g>
  
  <g id="sub-1-2" transform="translate(50,250)">
    <ellipse cx="0" cy="0" rx="40" ry="20" fill="#ffeaa7" stroke="#333" stroke-width="1"/>
    <text x="0" y="5" text-anchor="middle" font-family="Arial" font-size="12">细节2</text>
  </g>
  
  <g id="sub-2-1" transform="translate(950,150)">
    <ellipse cx="0" cy="0" rx="40" ry="20" fill="#fab1a0" stroke="#333" stroke-width="1"/>
    <text x="0" y="5" text-anchor="middle" font-family="Arial" font-size="12">要点1</text>
  </g>
  
  <!-- 连接线 - 曲线风格 -->
  <path id="main-to-1" d="M 420 350 Q 310 275 260 200" stroke="#333" stroke-width="3" fill="none"/>
  <path id="main-to-2" d="M 580 350 Q 690 275 740 200" stroke="#333" stroke-width="3" fill="none"/>
  <path id="main-to-3" d="M 420 350 Q 310 425 260 500" stroke="#333" stroke-width="3" fill="none"/>
  <path id="main-to-4" d="M 580 350 Q 690 425 740 500" stroke="#333" stroke-width="3" fill="none"/>
  
  <path id="branch1-to-sub1" d="M 140 200 Q 95 175 90 150" stroke="#666" stroke-width="2" fill="none"/>
  <path id="branch1-to-sub2" d="M 140 200 Q 95 225 90 250" stroke="#666" stroke-width="2" fill="none"/>
  <path id="branch2-to-sub1" d="M 860 200 Q 905 175 910 150" stroke="#666" stroke-width="2" fill="none"/>
  
  <!-- 装饰元素 -->
  <circle cx="100" cy="100" r="3" fill="#e74c3c"/>
  <circle cx="900" cy="100" r="3" fill="#e74c3c"/>
  <circle cx="100" cy="600" r="3" fill="#e74c3c"/>
  <circle cx="900" cy="600" r="3" fill="#e74c3c"/>
</svg>
`;

export const INVALID_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <rect x="50" y="50" width="100" height="60" fill="#ff6b6b"
  <text x="100" y="85">未闭合的文本
  <line x1="150" y1="80" x2="250" y2="80" stroke="#333"/>
  <!-- 缺少闭合标签 -->
`;

export const EMPTY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <!-- 空的SVG -->
</svg>
`;

export const LARGE_SVG_NODES = Array.from(
  { length: 100 },
  (_, i) => `
  <rect id="node${i}" x="${(i % 10) * 80 + 10}" y="${Math.floor(i / 10) * 60 + 10}" width="70" height="50" fill="#${Math.floor(Math.random() * 16777215).toString(16)}" stroke="#333"/>
  <text x="${(i % 10) * 80 + 45}" y="${Math.floor(i / 10) * 60 + 40}" text-anchor="middle" font-size="12">节点${i}</text>
`,
).join('');

export const LARGE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  ${LARGE_SVG_NODES}
</svg>
`;

export const SVG_WITH_GROUPS = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400">
  <g id="group1" transform="translate(100,100)">
    <rect x="0" y="0" width="80" height="60" fill="#ff6b6b" stroke="#333"/>
    <text x="40" y="35" text-anchor="middle" font-size="12">组1</text>
    <g id="subgroup1">
      <circle cx="40" cy="80" r="15" fill="#4ecdc4"/>
      <text x="40" y="85" text-anchor="middle" font-size="10">子1</text>
    </g>
  </g>
  
  <g id="group2" transform="translate(400,100)">
    <rect x="0" y="0" width="80" height="60" fill="#45b7d1" stroke="#333"/>
    <text x="40" y="35" text-anchor="middle" font-size="12">组2</text>
    <g id="subgroup2">
      <circle cx="40" cy="80" r="15" fill="#f7dc6f"/>
      <text x="40" y="85" text-anchor="middle" font-size="10">子2</text>
    </g>
  </g>
  
  <line x1="180" y1="130" x2="400" y2="130" stroke="#333" stroke-width="2"/>
</svg>
`;

export const SVG_TEST_CASES = {
  simple: SIMPLE_SVG,
  complex: COMPLEX_SVG,
  whimsical: WHIMSICAL_STYLE_SVG,
  invalid: INVALID_SVG,
  empty: EMPTY_SVG,
  large: LARGE_SVG,
  groups: SVG_WITH_GROUPS,
};
