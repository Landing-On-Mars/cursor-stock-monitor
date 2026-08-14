# cursor-stock-monitor

个人投资研究工作台。个股研究页从 Obsidian Vault 读取 Markdown，在浏览器里对照逻辑、预期跟踪和关联文章。

## 个股研究

打开 `/research`，点自选股即可切换驾驶舱：

- 一句话逻辑、买卖条件、预期跟踪、证伪/风险、时间线
- 关联文章按 `symbols` 匹配，可点开阅读
- 「在 Cursor 里问」只提供可复制的 Agent 提示词，网页不接模型 API

Vault 默认目录是与本项目同级的 `investment-vault`。也可以在 `.env.local` 里设置：

```
VAULT_PATH=C:\Users\musk\Documents\Journal
```

## Getting Started

```bash
npm install
npm run dev
```

默认地址：http://localhost:3000

## Scripts

- `npm run dev` 开发
- `npm run lint` 检查
- `npm test` Vault 解析单测

## License

MIT
