# Supabase Environment Configuration

This project uses lowercase environment variable names for Vercel compatibility.

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the root directory and add your Supabase credentials:

```bash
supabase_url=your_supabase_project_url
supabase_anon=your_supabase_anon_key
```

### 2. Vercel Configuration

The `vercel.json` file is configured to use these environment variables:
- `supabase_url` - Your Supabase project URL
- `supabase_anon` - Your Supabase anonymous key

### 3. Using Supabase in Your Code

Import the configuration in your JavaScript files:

```javascript
import { supabaseConfig } from './supabase-config.js';

// Use the configuration
const { supabaseUrl, supabaseAnonKey } = supabaseConfig;

// Initialize Supabase client
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## Security Notes

- Never commit `.env.local` to version control
- Use lowercase environment variable names for Vercel compatibility
- The `.env.example` file shows the required format without actual credentials

## Vercel Deployment

When deploying to Vercel:
1. Add your environment variables in the Vercel dashboard under Settings > Environment Variables
2. Use the same lowercase names: `supabase_url` and `supabase_anon`
3. The `vercel.json` configuration will automatically inject these into your application