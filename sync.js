const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');
const fs = require('fs');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

async function sync() {
  const databaseId = process.env.NOTION_DATABASE_ID;

  // 노션 DB에서 모든 항목 가져오기
  const response = await notion.databases.query({
    database_id: databaseId,
    sorts: [{ property: '날짜', direction: 'descending' }],
  });

  console.log(`총 ${response.results.length}개 항목 발견`);

  // refactor 폴더 없으면 생성
  if (!fs.existsSync('refactor')) {
    fs.mkdirSync('refactor');
  }

  for (const page of response.results) {
    const props = page.properties;

    // 날짜 가져오기
    const dateRaw = props['날짜']?.date?.start;
    if (!dateRaw) {
      console.log(`날짜 없는 항목 스킵: ${page.id}`);
      continue;
    }
    const date = dateRaw.slice(0, 10);

    // 한줄요약 가져오기 (띄어쓰기 있는/없는 버전 둘 다 대응)
    const summary =
      props['한줄요약']?.rich_text?.[0]?.plain_text ||
      props['한줄 요약']?.rich_text?.[0]?.plain_text ||
      '내용 없음';

    // 파일명
    const filename = `refactor/${date}.md`;

    // 이미 파일 있으면 스킵
    if (fs.existsSync(filename)) {
      console.log(`이미 존재: ${filename} 스킵`);
      continue;
    }

    // 페이지 본문을 마크다운으로 변환
    const mdBlocks = await n2m.pageToMarkdown(page.id);
    const mdString = n2m.toMarkdownString(mdBlocks);
    const body = typeof mdString === 'string' ? mdString : mdString?.parent ?? '';

    // 마크다운 파일 생성
    const content = `# 📅 ${date} 리팩토링\n\n> ${summary}\n\n${body}`;
    fs.writeFileSync(filename, content, 'utf8');
    console.log(`✅ 생성됨: ${filename}`);
  }

  console.log('🎉 동기화 완료!');
}

sync().catch((err) => {
  console.error('❌ 에러:', err);
  process.exit(1);
});
