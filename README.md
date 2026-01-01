# Time Tracker App

A web-based time tracking application that syncs across all devices. Track work hours with multiple profiles and customizable pay rates.

## Features

- ⏰ Clock in/out functionality
- 👤 Multiple work profiles with custom hourly rates
- 📊 Track earnings in real-time
- ☁️ Cloud synced - access from any device
- 📱 Mobile responsive (works on PC and phone)
- 🔐 Secure authentication

## Tech Stack

**Frontend:**
- React + TypeScript
- Vite
- Supabase Client

**Backend:**
- Node.js + Express
- TypeScript
- Supabase (PostgreSQL)

## Prerequisites

- Node.js (v18+)
- Supabase account (free tier)

## Setup Instructions

### 1. Clone and Install

\`\`\`bash
cd "c:\\Users\\jstickney\\Documents\\VISUAL STUDIO PROJECTS\\TIME TRACKING"
npm install
\`\`\`

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to Project Settings > API
4. Copy your project URL and anon key

### 3. Create Database Tables

In Supabase SQL Editor, run:

\`\`\`sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  hourly_rate DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Time entries table
CREATE TABLE time_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  clock_in TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  clock_out TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profiles"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profiles"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profiles"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profiles"
  ON profiles FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for time_entries
CREATE POLICY "Users can view own time entries"
  ON time_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own time entries"
  ON time_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time entries"
  ON time_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own time entries"
  ON time_entries FOR DELETE
  USING (auth.uid() = user_id);
\`\`\`

### 4. Configure Environment Variables

**Client (.env in client folder):**
\`\`\`
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
\`\`\`

**Server (.env in server folder):**
\`\`\`
PORT=5000
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here
\`\`\`

### 5. Run the Application

\`\`\`bash
# Development mode (runs both client and server)
npm run dev

# Or run separately:
npm run dev:client  # Runs on http://localhost:3000
npm run dev:server  # Runs on http://localhost:5000
\`\`\`

## Usage

1. **Sign Up:** Create an account with your email
2. **Create Profile:** Add a work profile with name and hourly rate
3. **Clock In:** Select a profile and clock in
4. **Clock Out:** When done, clock out to record your time
5. **View History:** See all your time entries and earnings

## Deployment

**Frontend (Vercel - Free):**
\`\`\`bash
cd client
npm run build
# Deploy to Vercel
\`\`\`

**Backend (Railway/Render - $0-7/month):**
- Connect your GitHub repo
- Set environment variables
- Deploy

## Database Schema

**profiles**
- id, user_id, name, hourly_rate, created_at, updated_at

**time_entries**
- id, user_id, profile_id, clock_in, clock_out, notes, created_at, updated_at

## Future Enhancements

- [ ] Reports and analytics
- [ ] Export to CSV/PDF
- [ ] Calendar view
- [ ] Break time tracking
- [ ] Team management
- [ ] Invoice generation

## License

MIT
