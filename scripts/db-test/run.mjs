// Uji otomatis database ApotekZ.
// Menyalakan Postgres sementara (tertanam), meniru bagian Supabase yang dipakai
// (role anon/authenticated, auth.users, auth.uid()), menjalankan SEMUA migrasi
// + fase 2 (kunci akses), lalu menguji aturan akses dan fungsi transaksi.
// Tidak menyentuh database Supabase asli.
//
// Jalankan:  cd scripts/db-test && npm install && npm test

import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 54329;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apotek-pg-'));

const server = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: false,
  onLog: () => {},
  onError: () => {},
});

const SHIM = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${String(e.message).split('\n')[0]}`);
  }
}

async function rejects(promise, pattern, label = '') {
  try {
    await promise;
  } catch (e) {
    if (pattern && !pattern.test(e.message)) {
      throw new Error(`${label} error tidak sesuai. Diharapkan ${pattern}, dapat: ${e.message}`);
    }
    return;
  }
  throw new Error(`${label} seharusnya ditolak tapi berhasil`);
}

let admin; // koneksi superuser
const ids = {};

// Jalankan satu perintah sebagai user tertentu (atau anon) lalu commit.
async function as(who, sql, params = []) {
  const c = admin;
  await c.query('begin');
  try {
    if (who === 'anon') {
      await c.query('set local role anon');
    } else {
      await c.query('set local role authenticated');
      await c.query("select set_config('request.jwt.claim.sub', $1, true)", [ids[who]]);
    }
    const r = await c.query(sql, params);
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback');
    throw e;
  }
}

const su = (sql, params = []) => admin.query(sql, params);
const one = async (sql, params = []) => (await su(sql, params)).rows[0];

const checkout = (who, items, o = {}) =>
  as(who, 'select public.checkout_sale($1,$2,$3,$4,$5,$6::jsonb,$7) as r', [
    o.name ?? '', o.phone ?? '', o.discount ?? 0, o.paid ?? 1e9, o.method ?? 'Tunai',
    JSON.stringify(items), o.rx ?? null,
  ]).then((r) => r.rows[0].r);

const stockOf = async (id) => (await one('select stock from medicines where id=$1', [id])).stock;

async function main() {
  await server.initialise();
  await server.start();
  await server.createDatabase('apotek');
  admin = new pg.Client({ host: 'localhost', port: PORT, user: 'postgres', password: 'postgres', database: 'apotek' });
  await admin.connect();

  console.log('\n[1] Menjalankan semua migrasi');
  await su(SHIM);
  const migDir = path.join(root, 'supabase/migrations');
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    try {
      await su(fs.readFileSync(path.join(migDir, f), 'utf8'));
    } catch (e) {
      throw new Error(`Migrasi ${f} gagal: ${e.message}`);
    }
  }
  console.log(`  ok   ${files.length} file migrasi berjalan tanpa error`);

  for (const u of ['owner', 'apoteker', 'kasir']) {
    ids[u] = (await one('insert into auth.users (email) values ($1) returning id', [`${u}@apotekz.local`])).id;
  }
  ids.kasir2 = (await one("insert into auth.users (email) values ('kasir2@apotekz.local') returning id")).id;
  ids.outsider = (await one("insert into auth.users (email) values ('x@gmail.com') returning id")).id;

  // Data uji
  const med = async (code, name, stock, price, cls = 'Obat Bebas') =>
    (await one(
      `insert into medicines (code,name,stock,sell_price,cost_price,drug_classification)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [code, name, stock, price, price / 2, cls],
    )).id;
  const A = await med('T-A', 'Parasetamol Uji', 10, 5000);
  const B = await med('T-B', 'Vitamin Uji', 100, 25000);
  const C = await med('T-C', 'Barang Terakhir', 1, 1000);
  const NARK = await med('T-N', 'Narkotika Uji', 5, 50000, 'Obat Narkotika');
  const KERAS = await med('T-K', 'Keras Uji', 5, 30000, 'Obat Keras');

  console.log('\n[2] Tautan akun Auth dan baseline sebelum dikunci');
  await test('akun owner/apoteker/kasir otomatis tertaut ke role lamanya', async () => {
    const r = await su("select username, role, is_active, auth_user_id from app_users where username in ('owner','apoteker','kasir') order by username");
    assert.equal(r.rows.length, 3);
    for (const row of r.rows) {
      assert.equal(row.role, row.username);
      assert.ok(row.auth_user_id, `${row.username} belum tertaut`);
      assert.equal(row.is_active, true);
    }
  });
  await test('username baru dibuat NONAKTIF (tidak otomatis punya akses)', async () => {
    const r = await one("select role, is_active from app_users where username='kasir2'");
    assert.equal(r.role, 'kasir');
    assert.equal(r.is_active, false);
  });
  await test('email di luar @apotekz.local tidak membuat akun aplikasi', async () => {
    const r = await one("select count(*)::int n from app_users where auth_user_id=$1", [ids.outsider]);
    assert.equal(r.n, 0);
  });
  await test('BASELINE: sebelum dikunci, anon bisa membaca obat (kondisi rawan lama)', async () => {
    const r = await as('anon', 'select count(*)::int n from medicines');
    assert.ok(r.rows[0].n > 0);
  });

  console.log('\n[3] Menjalankan fase 2 (kunci akses)');
  const lockSql = fs.readFileSync(path.join(root, 'supabase/phase2/lock_rls.sql'), 'utf8');
  await su(lockSql);
  console.log('  ok   lock_rls.sql berjalan tanpa error');
  await su("update app_users set is_active = true where username = 'kasir2'");

  // Data pancingan supaya uji "tidak terlihat" tidak kosong-melompong.
  await su("insert into incidents (title, description) values ('Insiden uji', 'x')");
  await su("insert into expenses (category, description, amount) values ('Listrik', 'uji', 100000)");
  await su("insert into purchase_orders (po_no) values ('PO-SEED')");
  await su("insert into void_log (sale_data, items_data, reason) values ('{}', '[]', 'seed')");

  console.log('\n[4] Akses anonim (tanpa login) ditolak');
  await test('anon tidak bisa membaca medicines', () => rejects(as('anon', 'select * from medicines'), /permission denied/));
  await test('anon tidak bisa membaca app_users', () => rejects(as('anon', 'select * from app_users'), /permission denied/));
  await test('anon tidak bisa menulis sales', () => rejects(as('anon', "insert into sales (invoice_no) values ('X')"), /permission denied/));
  await test('anon tidak bisa memanggil checkout_sale', () =>
    rejects(as('anon', "select public.checkout_sale('', '', 0, 0, 'Tunai', '[]'::jsonb, null)"), /permission denied/));
  await test('password_hash lama sudah dihapus semua', async () => {
    assert.equal((await one('select count(*)::int n from app_users where password_hash is not null')).n, 0);
  });

  console.log('\n[5] Aturan akses per role');
  await test('kasir: bisa baca obat', async () => {
    assert.ok((await as('kasir', 'select count(*)::int n from medicines')).rows[0].n >= 5);
  });
  await test('kasir: TIDAK bisa ubah harga obat langsung', async () => {
    const r = await as('kasir', "update medicines set sell_price = 1 where id = $1", [A]);
    assert.equal(r.rowCount, 0);
  });
  await test('kasir: TIDAK bisa tambah obat', () =>
    rejects(as('kasir', "insert into medicines (code,name) values ('Z','Z')"), /row-level security/));
  await test('kasir: TIDAK bisa hapus obat', async () => {
    assert.equal((await as('kasir', 'delete from medicines where id=$1', [A])).rowCount, 0);
  });
  await test('kasir: TIDAK bisa tulis langsung ke sales', () =>
    rejects(as('kasir', "insert into sales (invoice_no) values ('HACK')"), /row-level security/));
  await test('kasir: TIDAK bisa hapus sales langsung', async () => {
    assert.equal((await as('kasir', 'delete from sales')).rowCount, 0);
  });
  await test('kasir: tidak melihat PO, insiden mutu, audit log', async () => {
    for (const t of ['purchase_orders', 'incidents', 'audit_log', 'stock_movements', 'void_log', 'expenses']) {
      const real = (await su(`select count(*)::int n from ${t}`)).rows[0].n;
      if (t !== 'stock_movements') assert.ok(real > 0, `${t} harus ada isinya agar uji bermakna`);
      assert.equal((await as('kasir', `select count(*)::int n from ${t}`)).rows[0].n, 0, t);
    }
  });
  await test('kasir: hanya melihat akunnya sendiri di app_users', async () => {
    const r = await as('kasir', 'select username from app_users');
    assert.deepEqual(r.rows.map((x) => x.username), ['kasir']);
  });
  await test('kasir: TIDAK bisa mengubah app_settings', async () => {
    assert.equal((await as('kasir', "update app_settings set value='0.5' where key='tax_rate'")).rowCount, 0);
  });
  await test('kasir: TIDAK bisa menaikkan role sendiri lewat update langsung', async () => {
    assert.equal((await as('kasir', "update app_users set role='owner' where username='kasir'")).rowCount, 0);
  });
  await test('apoteker: bisa ubah harga obat, tidak bisa hapus obat', async () => {
    assert.equal((await as('apoteker', 'update medicines set sell_price = 5000 where id=$1', [A])).rowCount, 1);
    assert.equal((await as('apoteker', 'delete from medicines where id=$1', [C])).rowCount, 0);
  });
  await test('apoteker: tidak melihat insiden mutu (khusus owner), tapi melihat PO dan void_log', async () => {
    assert.equal((await as('apoteker', 'select count(*)::int n from incidents')).rows[0].n, 0);
    assert.ok((await as('owner', 'select count(*)::int n from incidents')).rows[0].n >= 1);
    assert.ok((await as('apoteker', 'select count(*)::int n from purchase_orders')).rows[0].n >= 1);
    assert.ok((await as('apoteker', 'select count(*)::int n from void_log')).rows[0].n >= 1);
  });
  await test('owner: melihat semua akun dan audit log', async () => {
    assert.equal((await as('owner', 'select count(*)::int n from app_users')).rows[0].n, 4);
    assert.ok((await as('owner', 'select count(*)::int n from audit_log')).rows[0].n > 0);
  });
  await test('akun nonaktif tidak punya akses sama sekali', async () => {
    await su("update app_users set is_active = false where username = 'kasir2'");
    assert.equal((await as('kasir2', 'select count(*)::int n from medicines')).rows[0].n, 0);
    await su("update app_users set is_active = true where username = 'kasir2'");
  });
  await test('audit_log tidak bisa diubah/dihapus dari aplikasi (termasuk owner)', async () => {
    await rejects(as('owner', 'delete from audit_log'), /permission denied/);
    await rejects(as('owner', "update audit_log set op='X'"), /permission denied/);
  });
  await test('audit_log mencatat pelaku dan role, tanpa password_hash', async () => {
    const r = await one("select actor_role from audit_log where table_name='medicines' and op='UPDATE' and actor=$1 order by id desc limit 1", [ids.apoteker]);
    assert.equal(r.actor_role, 'apoteker');
    const leak = await one("select count(*)::int n from audit_log where table_name='app_users' and (old_data ? 'password_hash' or new_data ? 'password_hash')");
    assert.equal(leak.n, 0);
  });

  console.log('\n[6] Checkout kasir (atomik, harga & stok dari server)');
  let firstInvoice;
  await test('checkout sukses: total, stok, nomor invoice, kasir tercatat', async () => {
    const r = await checkout('kasir', [{ medicine_id: A, qty: 2 }], { paid: 10000 });
    assert.equal(Number(r.sale.total), 10000);
    assert.match(r.sale.invoice_no, /^INV-\d{8}-0001$/);
    assert.equal(r.sale.cashier_id, ids.kasir);
    assert.equal(r.items.length, 1);
    firstInvoice = r.sale.id;
    assert.equal(await stockOf(A), 8);
    const m = await one("select delta, reason from stock_movements where medicine_id=$1 order by id desc limit 1", [A]);
    assert.deepEqual([m.delta, m.reason], [-2, 'sale']);
  });
  await test('item kembar di keranjang digabung, nomor invoice berurutan', async () => {
    const r = await checkout('kasir', [{ medicine_id: A, qty: 1 }, { medicine_id: A, qty: 2 }], { paid: 15000 });
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].quantity, 3);
    assert.match(r.sale.invoice_no, /-0002$/);
    assert.equal(await stockOf(A), 5);
  });
  await test('stok tidak cukup: ditolak dan TIDAK ada data setengah jadi', async () => {
    const before = (await one('select count(*)::int n from sales')).n;
    await rejects(checkout('kasir', [{ medicine_id: B, qty: 1 }, { medicine_id: A, qty: 99 }]), /Stok/);
    assert.equal((await one('select count(*)::int n from sales')).n, before);
    assert.equal(await stockOf(B), 100);
  });
  await test('pembayaran kurang ditolak', () => rejects(checkout('kasir', [{ medicine_id: A, qty: 1 }], { paid: 100 }), /Pembayaran kurang/));
  await test('jumlah nol/negatif dan obat tak dikenal ditolak', async () => {
    await rejects(checkout('kasir', [{ medicine_id: A, qty: -1 }]), /tidak valid/);
    await rejects(checkout('kasir', [{ medicine_id: A, qty: 0 }]), /tidak valid/);
    await rejects(checkout('kasir', [{ medicine_id: '00000000-0000-0000-0000-000000000000', qty: 1 }]), /tidak ditemukan/);
    await rejects(checkout('kasir', []), /kosong/);
  });
  await test('diskon: kasir dibatasi 10%, apoteker bebas (selama <= subtotal)', async () => {
    await rejects(checkout('kasir', [{ medicine_id: B, qty: 1 }], { discount: 5000 }), /batas kasir/);
    await checkout('kasir', [{ medicine_id: B, qty: 1 }], { discount: 2500 });
    await checkout('apoteker', [{ medicine_id: B, qty: 1 }], { discount: 12500 });
    await rejects(checkout('apoteker', [{ medicine_id: B, qty: 1 }], { discount: 30000 }), /Diskon tidak valid/);
  });
  await test('pajak diambil dari pengaturan owner, bukan dari layar kasir', async () => {
    await as('owner', "update app_settings set value='0.11' where key='tax_rate'");
    const r = await checkout('kasir', [{ medicine_id: B, qty: 1 }]);
    assert.equal(Number(r.sale.tax), 2750);
    assert.equal(Number(r.sale.total), 27750);
    await as('owner', "update app_settings set value='0' where key='tax_rate'");
  });
  await test('pelanggan & loyalty: dihitung server, akumulasi benar', async () => {
    await checkout('kasir', [{ medicine_id: B, qty: 1 }], { name: 'Budi', phone: '0811' });
    await checkout('kasir', [{ medicine_id: A, qty: 1 }], { name: 'Budi', phone: '0811' });
    const c = await one("select total_visits, loyalty_points, total_spent from customers where phone='0811'");
    assert.equal(c.total_visits, 2);
    assert.equal(c.loyalty_points, 1); // hanya transaksi >= 20.000
    assert.equal(Number(c.total_spent), 30000);
  });

  console.log('\n[7] Aturan obat berpengawasan (resep)');
  await su("insert into prescriptions (rx_no, patient_name) values ('RX-1','Pasien Satu'), ('RX-2','Pasien Dua'), ('RX-3','Pasien Tiga')");
  await test('Narkotika: kasir ditolak walau punya resep', () =>
    rejects(checkout('kasir', [{ medicine_id: NARK, qty: 1 }], { rx: 'RX-1' }), /Narkotika hanya/));
  await test('Narkotika: apoteker tanpa resep ditolak', () =>
    rejects(checkout('apoteker', [{ medicine_id: NARK, qty: 1 }]), /wajib disertai nomor resep/));
  await test('Narkotika: apoteker dengan resep sukses, resep otomatis terhubung & dispensed', async () => {
    const r = await checkout('apoteker', [{ medicine_id: NARK, qty: 1 }], { rx: 'RX-1' });
    const p = await one("select status, sale_id from prescriptions where rx_no='RX-1'");
    assert.equal(p.status, 'dispensed');
    assert.equal(p.sale_id, r.sale.id);
  });
  await test('resep yang sudah dipakai tidak bisa dipakai lagi', () =>
    rejects(checkout('apoteker', [{ medicine_id: NARK, qty: 1 }], { rx: 'RX-1' }), /sudah dipakai/));
  await test('resep fiktif ditolak', () =>
    rejects(checkout('apoteker', [{ medicine_id: NARK, qty: 1 }], { rx: 'NGAWUR' }), /tidak ditemukan/));
  await test('Obat Keras: kasir tanpa resep ditolak, dengan resep OK, apoteker boleh', async () => {
    await rejects(checkout('kasir', [{ medicine_id: KERAS, qty: 1 }]), /Obat Keras wajib/);
    await checkout('kasir', [{ medicine_id: KERAS, qty: 1 }], { rx: 'RX-2' });
    await checkout('apoteker', [{ medicine_id: KERAS, qty: 1 }]);
  });

  console.log('\n[8] Race condition: dua kasir membeli stok terakhir bersamaan');
  await test('hanya satu yang berhasil, stok tidak pernah negatif', async () => {
    const c1 = new pg.Client({ host: 'localhost', port: PORT, user: 'postgres', password: 'postgres', database: 'apotek' });
    const c2 = new pg.Client({ host: 'localhost', port: PORT, user: 'postgres', password: 'postgres', database: 'apotek' });
    await c1.connect();
    await c2.connect();
    const run = async (c, who) => {
      await c.query('begin');
      await c.query('set local role authenticated');
      await c.query("select set_config('request.jwt.claim.sub', $1, true)", [ids[who]]);
      return c.query('select public.checkout_sale($1,$2,$3,$4,$5,$6::jsonb,$7)',
        ['', '', 0, 1e6, 'Tunai', JSON.stringify([{ medicine_id: C, qty: 1 }]), null]);
    };
    await run(c1, 'kasir'); // memegang kunci baris
    const p2 = run(c2, 'apoteker').then(() => 'ok', (e) => e.message);
    await new Promise((r) => setTimeout(r, 400));
    await c1.query('commit');
    const res2 = await p2;
    await c2.query('rollback').catch(() => {});
    await c1.end();
    await c2.end();
    assert.match(String(res2), /Stok/);
    assert.equal(await stockOf(C), 0);
  });

  console.log('\n[9] Pembatalan transaksi (void) dan retur');
  await test('kasir tidak boleh membatalkan transaksi yang sudah dicetak/selesai', async () => {
    await as('kasir', 'select public.mark_sale_completed($1)', [firstInvoice]);
    await rejects(as('kasir', "select public.void_sale($1,'salah input')", [firstInvoice]), /belum dicetak/);
  });
  await test('kasir boleh membatalkan transaksinya sendiri yang belum dicetak (stok kembali)', async () => {
    const r = await checkout('kasir', [{ medicine_id: B, qty: 3 }]);
    const before = await stockOf(B);
    await as('kasir', "select public.void_sale($1,'pelanggan batal')", [r.sale.id]);
    assert.equal(await stockOf(B), before + 3);
    assert.equal((await one('select count(*)::int n from sales where id=$1', [r.sale.id])).n, 0);
  });
  await test('kasir tidak boleh membatalkan transaksi kasir/apoteker lain', async () => {
    const r = await checkout('apoteker', [{ medicine_id: B, qty: 1 }]);
    await rejects(as('kasir', "select public.void_sale($1,'iseng')", [r.sale.id]), /belum dicetak/);
  });
  await test('void wajib alasan, tercatat di void_log, loyalty pelanggan dikembalikan', async () => {
    const r = await checkout('kasir', [{ medicine_id: B, qty: 1 }], { name: 'Sari', phone: '0822' });
    await as('kasir', 'select public.mark_sale_completed($1)', [r.sale.id]);
    await rejects(as('apoteker', "select public.void_sale($1,'')", [r.sale.id]), /Alasan/);
    await as('apoteker', "select public.void_sale($1,'salah harga, dikoreksi apoteker')", [r.sale.id]);
    const log = await one('select reason, voided_by_role, jsonb_array_length(items_data) n from void_log where sale_id=$1', [r.sale.id]);
    assert.equal(log.voided_by_role, 'apoteker');
    assert.equal(log.n, 1);
    const cust = await one("select total_visits, total_spent from customers where phone='0822'");
    assert.equal(cust.total_visits, 0);
    assert.equal(Number(cust.total_spent), 0);
  });
  await test('void melepas resep kembali ke pending', async () => {
    const r = await checkout('apoteker', [{ medicine_id: NARK, qty: 1 }], { rx: 'RX-3' });
    await as('apoteker', "select public.void_sale($1,'resep salah pasien')", [r.sale.id]);
    const p = await one("select status, sale_id from prescriptions where rx_no='RX-3'");
    assert.equal(p.status, 'pending');
    assert.equal(p.sale_id, null);
  });
  await test('retur: tidak boleh melebihi jumlah beli (kumulatif), stok bertambah', async () => {
    const r = await checkout('kasir', [{ medicine_id: B, qty: 3 }]);
    const itemId = r.items[0].id;
    const before = await stockOf(B);
    await as('kasir', "select public.process_return($1, 2, 'kemasan rusak')", [itemId]);
    assert.equal(await stockOf(B), before + 2);
    await rejects(as('kasir', "select public.process_return($1, 2, 'coba lagi')", [itemId]), /melebihi pembelian/);
    await as('kasir', "select public.process_return($1, 1, 'sisa')", [itemId]);
    await rejects(as('kasir', "select public.process_return($1, 1, 'kelewat')", [itemId]), /melebihi pembelian/);
    await rejects(as('kasir', "select public.process_return($1, 1, '')", [itemId]), /Alasan/);
    await rejects(as('apoteker', "select public.void_sale($1,'mau batal')", [r.sale.id]), /sudah memiliki retur/);
  });

  console.log('\n[10] Purchase order dan stok opname');
  await test('terima PO: hanya owner/apoteker, stok bertambah sekali saja', async () => {
    const sup = (await one("insert into suppliers (name) values ('PBF Uji') returning id")).id;
    const po = (await one("insert into purchase_orders (po_no, supplier_id, status) values ('PO-T1',$1,'sent') returning id", [sup])).id;
    await su('insert into po_items (po_id, medicine_id, medicine_name, quantity) values ($1,$2,$3,50)', [po, B, 'Vitamin Uji']);
    await rejects(as('kasir', 'select public.receive_purchase_order($1)', [po]), /Tidak diizinkan/);
    const before = await stockOf(B);
    await as('apoteker', 'select public.receive_purchase_order($1)', [po]);
    assert.equal(await stockOf(B), before + 50);
    assert.equal((await one("select status from purchase_orders where id=$1", [po])).status, 'received');
    await rejects(as('apoteker', 'select public.receive_purchase_order($1)', [po]), /sudah berstatus/);
    assert.equal(await stockOf(B), before + 50);
  });
  await test('opname: stok disesuaikan ke hitungan fisik, tercatat di kartu stok', async () => {
    const op = (await one("insert into stock_opnames (opname_no) values ('OP-T1') returning id")).id;
    const cur = await stockOf(B);
    await su('insert into stock_opname_items (opname_id, medicine_id, system_stock, physical_stock) values ($1,$2,$3,$4)', [op, B, cur, cur - 4]);
    await rejects(as('kasir', 'select public.complete_stock_opname($1)', [op]), /Tidak diizinkan/);
    await as('apoteker', 'select public.complete_stock_opname($1)', [op]);
    assert.equal(await stockOf(B), cur - 4);
    const m = await one("select delta, reason from stock_movements where medicine_id=$1 order by id desc limit 1", [B]);
    assert.deepEqual([m.delta, m.reason], [-4, 'opname']);
    await rejects(as('apoteker', 'select public.complete_stock_opname($1)', [op]), /sudah selesai/);
  });

  console.log('\n[11] Manajemen user');
  await test('hanya owner yang bisa ubah role / aktifkan user', async () => {
    await rejects(as('kasir', "select public.set_user_role('kasir','owner')"), /Tidak diizinkan/);
    await rejects(as('apoteker', "select public.set_user_active('kasir', false)"), /Tidak diizinkan/);
    await as('owner', "select public.set_user_role('kasir2','apoteker')");
    assert.equal((await one("select role from app_users where username='kasir2'")).role, 'apoteker');
  });
  await test('owner terakhir tidak bisa diturunkan/dinonaktifkan', async () => {
    await rejects(as('owner', "select public.set_user_role('owner','kasir')"), /owner terakhir/);
    await rejects(as('owner', "select public.set_user_active('owner', false)"), /owner terakhir/);
  });
  await test('owner pun tidak bisa menulis app_users langsung (harus lewat fungsi)', async () => {
    assert.equal((await as('owner', "update app_users set role='kasir' where username='owner'")).rowCount, 0);
  });

  console.log('\n[12] Shift kasir');
  await test('kasir hanya melihat/membuka shift miliknya', async () => {
    await as('kasir', "insert into cash_sessions (session_no, operator_name, opening_cash) values ('S-1','kasir',100000)");
    await as('apoteker', "insert into cash_sessions (session_no, operator_name, opening_cash) values ('S-2','apoteker',50000)");
    assert.equal((await as('kasir', 'select count(*)::int n from cash_sessions')).rows[0].n, 1);
    assert.equal((await as('owner', 'select count(*)::int n from cash_sessions')).rows[0].n, 2);
    await rejects(
      as('kasir', "insert into cash_sessions (session_no, operator_name, opened_by) values ('S-3','x',$1)", [ids.apoteker]),
      /row-level security/,
    );
  });

  console.log('\n[13] Rollback darurat berfungsi');
  await test('rollback_lock_rls.sql membuka akses lagi, lock_rls.sql mengunci lagi', async () => {
    await su(fs.readFileSync(path.join(root, 'supabase/phase2/rollback_lock_rls.sql'), 'utf8'));
    assert.ok((await as('anon', 'select count(*)::int n from medicines')).rows[0].n > 0);
    await su(lockSql);
    await rejects(as('anon', 'select * from medicines'), /permission denied/);
  });

  console.log(`\nHasil: ${passed} lulus, ${failed} gagal`);
  if (failed) console.log('Gagal:\n - ' + failures.join('\n - '));
}

try {
  await main();
} catch (e) {
  failed++;
  console.error('\nFATAL:', e.message);
} finally {
  await admin?.end().catch(() => {});
  await server.stop().catch(() => {});
  fs.rmSync(dataDir, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
