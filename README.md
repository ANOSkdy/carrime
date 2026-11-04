This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## AIモデルの設定

要約・自己PR・職務経歴の生成は、サーバー側の環境変数を共通で使用します。

| 環境変数 | 設定内容 |
| --- | --- |
| `GEMINI_API_KEY` | Gemini APIキー。ローカルでは `.env.local`、VercelではSecretとして保持します。 |
| `GEMINI_MODEL` | 使用するモデルID。現在の設定は `gemini-3.5-flash-lite` です。 |

`GEMINI_MODEL` はローカルの `.env.local` と、Vercelのプロジェクト設定の Environment Variables にConfigとして設定します。未設定・空文字の場合は、AI生成時に設定エラーになります。

VercelではProduction・Preview・Developmentごとに指定できます。モデルを変更するときは環境変数を更新し、対象環境を再デプロイしてください。

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
