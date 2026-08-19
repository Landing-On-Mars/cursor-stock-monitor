# cursor-stock-monitor

个人投资研究工作台。个股研究页从 Obsidian Vault 读取 Markdown，在浏览器里对照逻辑、预期跟踪和关联文章。

## 个股研究

打开 `/research`，点自选股即可切换驾驶舱：

- 一句话逻辑、买卖条件、预期跟踪、证伪/风险、时间线
- 关联文章按 `symbols` 匹配，可点开阅读
- 「在 Cursor 里问」只提供可复制的 Agent 提示词，网页不接模型 API

Vault 默认会找 Google Drive 里的 `Northstar\Vault`。家里是：

```
VAULT_PATH=C:\Users\musk\My Drive\Northstar\Vault
```

## 本机路径

| 机器 | Dashboard |
| --- | --- |
| 办公室 | `C:\Users\ht.tu\cursor-stock-monitor` |
| 家里 | `C:\Users\musk\cursor-stock-monitor` |

办公室先进入项目再装依赖、启动：

```powershell
cd C:\Users\ht.tu\cursor-stock-monitor
```

Vault 在 **设置** 页填写 Google Drive 里 `Northstar\Vault` 的完整路径，点保存。路径记在本机 `data/local-config.json`，办公室和家里互不影响。K 线缓存在 Vault 的 `MarketData` 目录，随 Drive 同步。不要再用 `Documents\Journal`。

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
