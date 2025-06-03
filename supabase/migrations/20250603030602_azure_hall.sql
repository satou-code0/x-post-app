/*
  # Initial database schema for X Post Scheduler
  
  1. New Tables
    - `profiles`: Stores user profile information
      - `id` (uuid, primary key) - References auth.users.id
      - `updated_at` (timestamp with time zone) - Last update timestamp
      - `username` (text) - Username for the application
      - `full_name` (text) - Full name of the user
      - `avatar_url` (text) - URL to the user's avatar image
      - `x_handle` (text) - User's X (Twitter) handle
      
    - `posts`: Stores post data and scheduling information
      - `id` (uuid, primary key)
      - `user_id` (uuid) - References profiles.id
      - `content` (text) - The content of the post
      - `scheduled_for` (timestamp with time zone) - When the post is scheduled to be published
      - `published` (boolean) - Whether the post has been published
      - `created_at` (timestamp with time zone) - Creation timestamp
      - `updated_at` (timestamp with time zone) - Last update timestamp
      - `media_urls` (text array) - URLs to media attached to the post
      - `status` (enum) - Status of the post (draft, scheduled, published, failed)
      
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  x_handle TEXT
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  media_urls TEXT[] DEFAULT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'published', 'failed')) DEFAULT 'draft'
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create security policies
CREATE POLICY "Users can read own profile" 
  ON profiles 
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can read own posts" 
  ON posts 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own posts" 
  ON posts 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts" 
  ON posts 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" 
  ON posts 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create trigger for updating the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();