-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Profiles
alter table public.profiles enable row level security;

-- Profiles Policies
create policy "Public profiles are viewable by everyone" 
  on public.profiles for select 
  using (true);

create policy "Users can update their own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

-- 2. BOOKS TABLE
create table public.books (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  author text,
  class integer not null check (class >= 1 and class <= 12),
  subject text not null,
  pdf_url text not null,
  thumbnail_url text,
  is_premium boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Books
alter table public.books enable row level security;

-- Books Policies
create policy "Books are viewable by everyone" 
  on public.books for select 
  using (true);

create policy "Only admins can insert books" 
  on public.books for insert 
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Only admins can update books" 
  on public.books for update 
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Only admins can delete books" 
  on public.books for delete 
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 3. SUBSCRIPTIONS TABLE
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  status text not null default 'inactive' check (status in ('active', 'inactive', 'expired')),
  plan_type text not null default 'premium',
  start_date timestamp with time zone default timezone('utc'::text, now()) not null,
  end_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Subscriptions
alter table public.subscriptions enable row level security;

-- Subscriptions Policies
create policy "Users can view their own subscriptions" 
  on public.subscriptions for select 
  using (auth.uid() = user_id);

create policy "Users can insert/update their own subscriptions (Simulated checkout)"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own subscriptions (Simulated checkout)"
  on public.subscriptions for update
  using (auth.uid() = user_id);

-- 4. HIGHLIGHTS TABLE
create table public.highlights (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  book_id uuid references public.books(id) on delete cascade not null,
  page_number integer not null,
  rects jsonb not null, -- Stores viewport-independent coordinates as array of [{x1,y1,x2,y2}]
  text text not null,
  color text not null default '#fbbf24',
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Highlights
alter table public.highlights enable row level security;

-- Highlights Policies
create policy "Users can manage their own highlights"
  on public.highlights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. NOTES TABLE
create table public.notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  book_id uuid references public.books(id) on delete cascade not null,
  page_number integer not null,
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Notes
alter table public.notes enable row level security;

-- Notes Policies
create policy "Users can manage their own notes"
  on public.notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6. BOOKMARKS TABLE
create table public.bookmarks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  book_id uuid references public.books(id) on delete cascade not null,
  page_number integer not null,
  label text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, book_id, page_number)
);

-- Enable RLS for Bookmarks
alter table public.bookmarks enable row level security;

-- Bookmarks Policies
create policy "Users can manage their own bookmarks"
  on public.bookmarks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 7. READING PROGRESS TABLE
create table public.reading_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  book_id uuid references public.books(id) on delete cascade not null,
  last_page integer not null default 1,
  total_pages integer not null default 1,
  percentage_completed numeric not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, book_id)
);

-- Enable RLS for Reading Progress
alter table public.reading_progress enable row level security;

-- Reading Progress Policies
create policy "Users can manage their own reading progress"
  on public.reading_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- PROFILE AUTO-CREATION TRIGGER ON SIGNUP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    'user'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- UPDATE UPDATED_AT TRIGGER FUNCTION
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Set up updated_at triggers
create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger on_book_updated
  before update on public.books
  for each row execute procedure public.handle_updated_at();

create trigger on_subscription_updated
  before update on public.subscriptions
  for each row execute procedure public.handle_updated_at();

create trigger on_highlight_updated
  before update on public.highlights
  for each row execute procedure public.handle_updated_at();

create trigger on_note_updated
  before update on public.notes
  for each row execute procedure public.handle_updated_at();

create trigger on_reading_progress_updated
  before update on public.reading_progress
  for each row execute procedure public.handle_updated_at();

-- 8. STORAGE BUCKET CONFIGURATION FOR BOOKS PDFS
-- Note: Requires Supabase Storage extension. If bucket already exists, this is skipped.
insert into storage.buckets (id, name, public)
values ('books', 'books', true)
on conflict (id) do nothing;

-- Storage Policies for 'books' bucket
create policy "Books bucket files are viewable by everyone"
  on storage.objects for select
  using (bucket_id = 'books');

create policy "Admins can upload files to books bucket"
  on storage.objects for insert
  with check (
    bucket_id = 'books' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can update files in books bucket"
  on storage.objects for update
  using (
    bucket_id = 'books' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can delete files from books bucket"
  on storage.objects for delete
  using (
    bucket_id = 'books' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

