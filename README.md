# CaterlyAI - AI-Powered Catering Business Platform

CaterlyAI is a comprehensive business platform that helps catering companies streamline their operations, generate leads, and automate outreach campaigns. The application leverages advanced AI technology to provide intelligent business tools designed specifically for the catering industry.

## Key Features

- **AI-Powered Business Profile Generation**: Create compelling business profiles with targeted marketing content
- **Lead Discovery & Enrichment**: Find and qualify potential clients with AI-enriched data
- **Automated Email Outreach Campaigns**: Create and schedule personalized email sequences
- **Web Data Extraction**: Extract valuable information from business websites
- **Intelligent Lead Scoring**: Automatically score and prioritize leads

## Main Agentic Workflows

CaterlyAI is built around three core AI-powered workflows:

### 1. Profile Generation Workflow

This workflow helps catering businesses create comprehensive, marketing-focused profiles that highlight their unique selling points and competitive advantages.

**Functionality:**
- Generates compelling business taglines and descriptions
- Identifies key selling points and competitive advantages
- Defines target audience segments with demographic details
- Creates detailed ideal client profiles with approach strategies
- Provides tailored marketing recommendations

**Implementation:**
- Located in `src/workflows/profile-generation`
- Uses the Profile Agent in `src/agents/profileAgent.ts`
- Consists of three main steps: validation, AI generation, and saving

### 2. Lead Enrichment Workflow

This workflow automatically extracts and enhances business data from prospect websites to provide valuable insights and qualify leads.

**Functionality:**
- Extracts venue information, capacity, and amenities
- Identifies event capabilities and preferred caterers
- Determines if venues have in-house catering
- Extracts contact information for event managers
- Calculates lead scores based on fit for catering services

**Implementation:**
- Located in `src/workflows/lead-enrichment`
- Uses the Enrichment Agent in `src/agents/enrichmentAgent.ts`
- Utilizes the Firecrawl API for website data extraction
- Workflow steps: fetch leads, extract website data, process data, update leads

### 3. Outreach Campaign Workflow

This workflow automates the creation and scheduling of personalized email campaigns tailored to different venue categories.

**Functionality:**
- Generates category-specific email templates (wedding, corporate, education, etc.)
- Creates natural-sounding, personalized email sequences
- Includes seasonal and holiday references where appropriate
- Schedules drip campaigns with optimal timing
- Handles email approval and campaign launch

**Implementation:**
- Located in `src/workflows/outreach-campaign`
- Uses the Outreach Agent in `src/agents/outreachAgent.ts`
- Workflow steps: fetch leads, generate emails, launch campaign

## Architecture

CaterlyAI is built with a modern tech stack:

- **Frontend**: React, Next.js, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase
- **AI Integration**: OpenAI API, Together AI
- **Data Extraction**: Firecrawl API
- **Email Delivery**: Resend API

### Key Components

- **Agents**: AI agents specialized for different tasks (`src/agents/`)
- **Workflows**: Multi-step processes that orchestrate complex tasks (`src/workflows/`)
- **Tools**: Utility services for external API integration (`src/tools/`)
- **Components**: UI components for different application features (`src/components/`)
- **API Routes**: Backend endpoints for data processing and API calls (`src/app/api/`)

## Project Structure

```
src/
├── agents/                 # AI agent implementations
│   ├── businessAgent.ts    # Business search and discovery
│   ├── enrichmentAgent.ts  # Lead data enrichment
│   ├── outreachAgent.ts    # Email campaign generation
│   └── profileAgent.ts     # Business profile generation
│
├── app/                    # Next.js application routes
│   ├── api/                # API endpoints
│   ├── campaign/           # Campaign management
│   ├── dashboard/          # User dashboard
│   ├── leads/              # Lead management
│   └── profile/            # Profile management
│
├── components/             # React components
│   ├── campaign-launch-page.tsx  # Email campaign UI
│   ├── enriched-leads-page.tsx   # Lead enrichment UI
│   ├── profile-setup-page.tsx    # Profile setup UI
│   └── ...
│
├── workflows/              # Workflow implementations
│   ├── lead-enrichment/    # Lead enrichment workflow
│   ├── outreach-campaign/  # Email campaign workflow
│   └── profile-generation/ # Profile generation workflow
│
├── tools/                  # External API integrations
│   ├── firecrawl.ts        # Website data extraction
│   ├── resend.ts           # Email delivery
│   └── ...
│
└── utils/                  # Utility functions
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm
- OpenAI API key
- Supabase account
- Together AI API key (optional)
- Firecrawl API key (for web extraction)
- Resend API key (for email campaigns)

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/catering-ai.git
   cd catering-ai
   ```

2. Install dependencies
   ```
   pnpm install
   ```

3. Set up environment variables
   Create a `.env.local` file with the required API keys and configuration:
   ```
   OPENAI_API_KEY=your_openai_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
   FIRECRAWL_API_KEY=your_firecrawl_key
   RESEND_API_KEY=your_resend_key
   TOGETHER_API_KEY=your_together_key
   ```

4. Run the development server
   ```
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Notes on Deployment

When deploying to Vercel, be aware of the following:

- API routes that call OpenAI may experience timeout issues due to the default 10-second limit.
- Consider implementing background processing for long-running tasks like email generation.
- Set all environment variables in your Vercel project settings.

## Troubleshooting

**Gateway Timeout (504) on Email Generation**

The email generation process makes extensive calls to OpenAI which can exceed Vercel's default timeout limits. Consider:

1. Using background jobs for email generation
2. Implementing a webhook pattern for completion notification
3. Breaking email generation into smaller batches 