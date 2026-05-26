# Rootward 文档工作区

本目录维护 Rootward 的书籍化契约文档。当前核心书稿是 `books/06-rootward-project-cli-contract/`。

## 目录结构

```text
catalog.adoc          # 文档书库入口
books/                # 每个一级子目录是一本独立 AsciiDoc book
shared/               # 跨书共享属性
scripts/              # 工作区级构建脚本
test/                 # 构建脚本测试
package.json          # 文档工作区 Node 依赖入口
```

## 书目

- `books/06-rootward-project-cli-contract/`：定义 Rootward 项目型 CLI 模板体系的对象边界、公共契约、跨语言实现和验证标准。

## 构建

安装依赖：

```bash
pnpm install
```

运行脚本测试：

```bash
pnpm run test
```

构建 HTML：

```bash
pnpm run build
```

输出入口：

```text
build/html/catalog.html
```

契约书输出：

```text
build/html/books/06-rootward-project-cli-contract/book.html
```

## 版本控制边界

`tmp/`、`build/` 和 `node_modules/` 不进入版本控制。`tmp/` 只保存临时资料和一次性研究材料。
