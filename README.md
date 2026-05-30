# musicranking

一个完全自用、无商业成分的极简音乐评分网站。项目使用 Vite、React 和 TypeScript，可部署到 GitHub Pages。

## 功能

- 搜索歌手/乐队并从 MusicBrainz 导入专辑、EP、单曲信息。
- 使用 Cover Art Archive 展示封面。
- 打开专辑查看曲目，并把单曲或整张专辑加入个人收藏。
- 对歌词、作曲、编曲制作、演唱演奏、个人喜好五个维度打分。
- 在设置中调整五个维度权重，收藏列表自动按加权平均分排序。
- 支持按歌手、专辑、歌名搜索，以及按歌曲标签/专辑标签筛选。
- 自动保存到浏览器本地，支持 JSON 导入/导出。

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

构建结果会输出到 `dist/`。由于 Vite 配置使用相对路径 `base: "./"`，可以直接把 `dist/` 发布到 GitHub Pages。

## 数据说明

首版采用纯静态方案，不提前下载大型数据库。MusicBrainz 请求会在浏览器端排队，尽量控制到约每秒一次，并把结果缓存在 `localStorage` 中。

## License

MIT
