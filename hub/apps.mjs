// Every demo runs against the real TypeSafe API. There are no mock modes.
export const HUB_PORT = Number(process.env.HUB_PORT || 4310);

export const apps = [
  {
    id: 'support',
    name: 'Support desk',
    blurb: 'Jev routes new support requests to a team; consultants review the rest.',
    port: 4311,
    path: '/',
    command: ['npm', 'run', 'dev', '--', '--port', '4311'],
    env: (e) => ({
      TYPESAFE_API_KEY: e.SUPPORT_TYPESAFE_API_KEY || e.TYPESAFE_API_KEY,
      TYPESAFE_DEFAULT_MODEL: e.SUPPORT_TYPESAFE_MODEL || 'jev-1.13.0',
      DATABASE_PATH: './data/demo.sqlite',
    }),
    requires: ['TYPESAFE_API_KEY'],
  },
  {
    id: 'rag',
    name: 'RAG routing',
    blurb: 'Jev decides whether a chat turn needs retrieval; an LLM (OpenRouter or OpenAI) writes the answer.',
    port: 4312,
    path: '/',
    command: ['npm', 'run', 'dev', '--', '--port', '4312'],
    env: (e) => {
      const base = { TYPESAFE_MODEL: e.RAG_TYPESAFE_MODEL || 'jev-latest' };
      // OpenRouter speaks the OpenAI API; the openai SDK picks up OPENAI_BASE_URL itself.
      if (e.OPENROUTER_API_KEY && !e.OPENAI_API_KEY)
        return {
          ...base,
          OPENAI_API_KEY: e.OPENROUTER_API_KEY,
          OPENAI_BASE_URL: 'https://openrouter.ai/api/v1',
          OPENAI_MODEL: e.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
        };
      return { ...base, OPENAI_MODEL: e.OPENAI_MODEL || 'gpt-4.1-mini' };
    },
    requires: ['TYPESAFE_API_KEY', 'OPENAI_API_KEY'],
    keyHint: { OPENAI_API_KEY: 'OPENROUTER_API_KEY or OPENAI_API_KEY' },
  },
  {
    id: 'vision',
    name: 'Vision playground',
    blurb: 'Ask Jev about a photo with box, noul, choice or score questions.',
    // Port 3000: the "AI image filter" browser extension sends images to this same server.
    port: 3000,
    path: '/',
    command: ['npm', 'run', 'dev'],
    env: (e) => ({ PORT: '3000', TYPESAFE_MODEL: e.VISION_TYPESAFE_MODEL || 'jev-preview' }),
    requires: ['TYPESAFE_API_KEY'],
    build: 'build:extension',
    // Also listed on the Extensions tab, but it starts with the hub because it backs a web tab.
    card: {
      name: 'AI image filter',
      blurb: 'Marks or hides images Jev rates as AI-generated. Shares its server with the Vision playground tab.',
      health: '/api/status',
      dist: 'dist/extension',
    },
    sites: 'LinkedIn and Facebook images',
    firefox: 'Firefox 140+',
  },
  {
    id: 'hotdog',
    name: 'Hotdog / not hotdog',
    blurb: 'One yes/no image question, with the full request and response trace.',
    port: 4314,
    path: '/',
    command: ['npm', 'start'],
    env: (e) => ({ PORT: '4314', TYPESAFE_MODEL: e.HOTDOG_TYPESAFE_MODEL || 'jev-preview' }),
    requires: ['TYPESAFE_API_KEY'],
  },
  {
    id: 'refs',
    name: 'Image references',
    blurb: 'Pictures inside instructions and criteria: compare with a reference, options and score levels defined by example.',
    port: 4315,
    path: '/',
    command: ['npm', 'start'],
    env: (e) => ({ PORT: '4315', TYPESAFE_MODEL: e.REFS_TYPESAFE_MODEL || 'jev-preview' }),
    requires: ['TYPESAFE_API_KEY'],
  },
  {
    id: 'headlines',
    sites: 'onet.pl, wp.pl and other news sites',
    firefox: 'Firefox 142+',
    name: 'Headline Lens',
    blurb: 'Labels how news headlines are written (curiosity gap, alarmist, …).',
    // 3001 / 4317 / 4318 match the ports the browser extensions call.
    port: 3001,
    path: '/fixture',
    command: ['npm', 'start'],
    env: (e) => ({ PORT: '3001', TYPESAFE_MODEL: e.HEADLINES_TYPESAFE_MODEL || 'jev-latest' }),
    requires: ['TYPESAFE_API_KEY'],
    build: 'build',
    extension: true, // started on demand from the Extensions tab
  },
  {
    id: 'linkedin',
    sites: 'linkedin.com feed',
    firefox: 'Firefox 140+',
    name: 'LinkedIn BS detector',
    blurb: 'Five Jev judgments per post; plain code turns them into a meter.',
    port: 4317,
    path: '/',
    command: ['npm', 'start'],
    env: (e) => ({ PORT: '4317', TYPESAFE_MODEL: e.LINKEDIN_TYPESAFE_MODEL || 'jev-latest' }),
    requires: ['TYPESAFE_API_KEY'],
    build: 'build',
    extension: true, // started on demand from the Extensions tab
  },
  {
    id: 'youtube',
    sites: 'YouTube video comments',
    firefox: 'Firefox 121+',
    name: 'YouTube insights',
    blurb: 'Highlights YouTube comments that add information or perspective.',
    port: 4318,
    path: '/',
    command: ['npm', 'run', 'dev'],
    env: (e) => ({ PORT: '4318', TYPESAFE_MODEL: e.YOUTUBE_TYPESAFE_MODEL || 'jev-latest' }),
    requires: ['TYPESAFE_API_KEY'],
    build: 'build',
    extension: true, // started on demand from the Extensions tab
  },
];
