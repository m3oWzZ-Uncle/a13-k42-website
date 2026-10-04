import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const VIEWER = '22222222-2222-4222-8222-222222222222';
const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const bootstrap = await readFile(new URL('../supabase/first-admin.sql', import.meta.url), 'utf8');
async function database() {
  const db = new PGlite();
  // Model Supabase's auth and storage schemas, then execute the production SQL.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, email_confirmed_at timestamptz);
    create table auth.identities(user_id uuid, provider text);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to authenticated,anon;
    grant all on storage.objects to authenticated,anon;
  `);
  await db.exec(schema);
  await db.query(`insert into auth.users values ($1,'phungquangthai123ok@gmail.com','{}',now()),($2,'viewer@example.com','{"role":"admin"}',now())`, [ADMIN, VIEWER]);
  await db.query(`insert into auth.identities values ($1,'google')`, [ADMIN]);
  return db;
}
async function asUser(db, id, sql, parameters = []) {
  await db.exec('begin');
  try {
    await db.query(`select set_config('request.jwt.claim.sub',$1,true)`, [id || '']);
    await db.exec(`set local role ${id ? 'authenticated' : 'anon'}`);
    const result = await db.query(sql, parameters);
    await db.exec('commit'); return result;
  } catch (error) { await db.exec('rollback'); throw error; }
}
test('new users default to viewer even with forged admin metadata', async () => {
  const db = await database();
  try {
    const { rows } = await db.query('select role from public.profiles');
    assert.deepEqual(rows.map(row => row.role), ['viewer', 'viewer']);
  } finally { await db.close(); }
});
test('first admin requires confirmed Google identity and exact Gmail', async () => {
  const db = await database();
  try {
    await db.exec('delete from auth.identities');
    await assert.rejects(db.exec(bootstrap), /must sign in/);
    await db.query(`insert into auth.identities values ($1,'google')`, [ADMIN]);
    await db.exec(bootstrap);
    const { rows } = await db.query('select role from public.profiles where id=$1',[ADMIN]);
    assert.equal(rows[0].role,'admin');
  } finally { await db.close(); }
});
test('viewers read but cannot create/edit/delete entries or grant themselves admin', async () => {
  const db = await database();
  try {
    await db.exec(bootstrap);
    const { rows } = await asUser(db, ADMIN, `insert into public.entries(kind,title) values('memory','Ảnh lớp') returning id`);
    const id = rows[0].id;
    assert.equal((await asUser(db, VIEWER,'select * from public.entries')).rows.length,1);
    await assert.rejects(asUser(db, VIEWER,`insert into public.entries(kind,title) values('memory','Không được ghi')`),/row-level security/);
    assert.equal((await asUser(db, VIEWER,`update public.entries set title='Hacked' where id=$1 returning id`,[id])).rows.length,0);
    assert.equal((await asUser(db, VIEWER,`delete from public.entries where id=$1 returning id`,[id])).rows.length,0);
    await assert.rejects(asUser(db, VIEWER,`update public.profiles set role='admin' where id=$1`,[VIEWER]),/permission denied/);
    await assert.rejects(asUser(db, VIEWER,`select public.set_member_role($1,'admin')`,[VIEWER]),/Admin access required/);
    assert.equal((await asUser(db, VIEWER,'select * from public.profiles')).rows.length,1);
    await assert.rejects(asUser(db, null,'select * from public.entries'),/permission denied/);
  } finally { await db.close(); }
});
test('admin manages content and roles; revocation takes effect immediately and last admin remains', async () => {
  const db = await database();
  try {
    await db.exec(bootstrap);
    await assert.rejects(asUser(db, ADMIN,`select public.set_member_role($1,'viewer')`,[ADMIN]),/last admin/);
    await asUser(db, ADMIN,`select public.set_member_role($1,'admin')`,[VIEWER]);
    const { rows } = await asUser(db, VIEWER,`insert into public.entries(kind,title) values('note','Lưu bút') returning id`);
    assert.equal((await asUser(db, ADMIN,`update public.entries set title='Đã sửa' where id=$1 returning id`,[rows[0].id])).rows.length,1);
    await asUser(db, ADMIN,`select public.set_member_role($1,'viewer')`,[VIEWER]);
    await assert.rejects(asUser(db, VIEWER,`insert into public.entries(kind,title) values('memory','No')`),/row-level security/);
    assert.equal((await asUser(db, ADMIN,`delete from public.entries where id=$1 returning id`,[rows[0].id])).rows.length,1);
    assert.equal((await asUser(db, ADMIN,'select * from public.profiles')).rows.length,2);
  } finally { await db.close(); }
});
test('photo storage is private and only admins can upload or delete', async () => {
  const db = await database();
  try {
    await db.exec(bootstrap);
    await asUser(db, ADMIN,`insert into storage.objects(bucket_id,name) values('class-photos','a.jpg')`);
    assert.equal((await asUser(db, VIEWER,'select * from storage.objects')).rows.length,1);
    assert.equal((await asUser(db, null,'select * from storage.objects')).rows.length,0);
    await assert.rejects(asUser(db, VIEWER,`insert into storage.objects(bucket_id,name) values('class-photos','bad.jpg')`),/row-level security/);
    assert.equal((await asUser(db, VIEWER,`delete from storage.objects returning id`)).rows.length,0);
    assert.equal((await asUser(db, ADMIN,`delete from storage.objects returning id`)).rows.length,1);
    const { rows } = await db.query(`select public from storage.buckets where id='class-photos'`);
    assert.equal(rows[0].public,false);
  } finally { await db.close(); }
});
