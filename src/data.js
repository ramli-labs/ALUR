/* ALUR (Lab Maya Pseudocode) — contoh dari modul dan misi LKPD */
(function (root) {
  'use strict';

  const EXAMPLES = [
    { id: 'faktorial', title: 'Faktorial n (Tabel jejak LKPD 1C)', tp: 'BK.9.9', inputs: '4', code:
`# Menghitung faktorial n dengan SELAMA
MULAI
  INPUT n
  hasil ← 1
  i ← 1
  SELAMA i ≤ n
    hasil ← hasil × i
    i ← i + 1
  AKHIR SELAMA
  OUTPUT hasil
SELESAI` },
    { id: 'rata', title: 'Rata-rata nilai (nilai sentinel -1)', tp: 'BK.9.8', inputs: '80, 90, 70, -1', code:
`# Menghitung rata-rata nilai dari daftar siswa
MULAI
  # Deklarasi variabel
  total ← 0
  jumlah ← 0
  nilai ← 0
  rata_rata ← 0
  # Input data: masukkan nilai satu per satu, -1 untuk berhenti
  INPUT nilai
  SELAMA nilai ≠ -1
    total ← total + nilai
    jumlah ← jumlah + 1
    INPUT nilai
  AKHIR SELAMA
  # Hitung dan tampilkan rata-rata
  JIKA jumlah > 0 MAKA
    rata_rata ← total ÷ jumlah
    OUTPUT "Rata-rata: " + rata_rata
    OUTPUT "Total siswa: " + jumlah
  JIKA LAIN
    OUTPUT "Tidak ada data yang diinput."
  AKHIR JIKA
SELESAI` },
    { id: 'login', title: 'Algoritma login (ada bug, temukan!)', tp: 'BK.9.7', inputs: 'budi, 0000', code:
`# Algoritma login sederhana (dari modul)
PROSEDUR tampilkan_halaman_utama()
  OUTPUT "=== Halaman Utama ==="
AKHIR PROSEDUR

MULAI
  INPUT username, password
  JIKA username = "admin" DAN password = "1234" MAKA
    OUTPUT "Login berhasil!"
    tampilkan_halaman_utama()
  JIKA LAIN
    OUTPUT "Username atau password salah."
    counter_gagal ← counter_gagal + 1
    JIKA counter_gagal >= 3 MAKA
      OUTPUT "Akun dikunci. Hubungi admin."
    AKHIR JIKA
  AKHIR JIKA
SELESAI` },
    { id: 'predikat', title: 'Kalkulator predikat nilai', tp: 'BK.9.9', inputs: '95, 85, 72, 64, 40', code:
`# Kalkulator Predikat Nilai (Kurikulum Merdeka)
FUNGSI tentukan_predikat(nilai)
  JIKA nilai >= 90 MAKA
    KEMBALIKAN "A (Sangat Baik)"
  JIKA LAIN JIKA nilai >= 80 MAKA
    KEMBALIKAN "B (Baik)"
  JIKA LAIN JIKA nilai >= 70 MAKA
    KEMBALIKAN "C (Cukup)"
  JIKA LAIN JIKA nilai >= 60 MAKA
    KEMBALIKAN "D (Perlu Perbaikan)"
  JIKA LAIN
    KEMBALIKAN "E (Tidak Lulus)"
  AKHIR JIKA
AKHIR FUNGSI

# Program Utama
MULAI
  UNTUK i DARI 1 HINGGA 5
    INPUT nilai
    predikat ← tentukan_predikat(nilai)
    OUTPUT "Nilai " + nilai + " → " + predikat
  AKHIR UNTUK
SELESAI` },
    { id: 'validasi', title: 'Validasi input (SELAMA) & akumulasi (UNTUK)', tp: 'BK.9.9', inputs: '150, -5, 87', code:
`# Contoh SELAMA untuk validasi input
MULAI
  INPUT angka
  SELAMA angka < 0 ATAU angka > 100
    OUTPUT "Input tidak valid! Masukkan 0–100:"
    INPUT angka
  AKHIR SELAMA
  OUTPUT "Input valid: " + angka
  # Contoh UNTUK untuk kalkulasi akumulasi
  total ← 0
  UNTUK i DARI 1 HINGGA 10
    total ← total + i
  AKHIR UNTUK
  OUTPUT "Jumlah 1+2+...+10 = " + total
SELESAI` },
    { id: 'modular', title: 'Program modular: sistem nilai lengkap', tp: 'BK.9.10', inputs: '3, 80, 90, 70', code:
`# Program terstruktur dengan beberapa subprogram
FUNGSI baca_nilai(n_siswa)
  nilai_list ← ARRAY kosong
  UNTUK i DARI 1 HINGGA n_siswa
    INPUT nilai
    TAMBAH nilai KE nilai_list
  AKHIR UNTUK
  KEMBALIKAN nilai_list
AKHIR FUNGSI

FUNGSI hitung_statistik(data)
  total ← 0
  maks ← data[1]
  min_val ← data[1]
  UNTUK SETIAP n DALAM data
    total ← total + n
    JIKA n > maks MAKA maks ← n AKHIR JIKA
    JIKA n < min_val MAKA min_val ← n AKHIR JIKA
  AKHIR UNTUK
  KEMBALIKAN total/panjang(data), maks, min_val
AKHIR FUNGSI

PROSEDUR cetak_laporan(rata, maks, min_val)
  OUTPUT "=== LAPORAN NILAI ==="
  OUTPUT "Rata-rata : " + rata
  OUTPUT "Tertinggi : " + maks
  OUTPUT "Terendah  : " + min_val
AKHIR PROSEDUR

# Program Utama
MULAI
  INPUT jumlah_siswa
  data ← baca_nilai(jumlah_siswa)
  rata, maks, min_val ← hitung_statistik(data)
  cetak_laporan(rata, maks, min_val)
SELESAI` },
    { id: 'scope', title: 'Ruang lingkup variabel (scope)', tp: 'BK.9.10', inputs: '', code:
`# Variabel lokal hanya hidup di dalam fungsinya
FUNGSI hitung()
  temp ← 5
  KEMBALIKAN temp × 2
AKHIR FUNGSI

MULAI
  hasil ← hitung()
  OUTPUT hasil
  OUTPUT temp
SELESAI` },
    { id: 'suhu', title: 'Cek suhu tubuh (seleksi)', tp: 'BK.9.11', inputs: '38.2', code:
`MULAI
  INPUT suhu
  JIKA suhu > 37.5 MAKA
    OUTPUT "Demam"
  JIKA LAIN
    OUTPUT "Normal"
  AKHIR JIKA
SELESAI` },
    { id: 'fizzbuzz', title: 'FizzBuzz 1–100', tp: 'BK.9.11', inputs: '', code:
`# PSEUDOCODE FizzBuzz
MULAI
  UNTUK i DARI 1 HINGGA 100
    JIKA i MOD 15 = 0 MAKA
      OUTPUT "FizzBuzz"
    JIKA LAIN JIKA i MOD 3 = 0 MAKA
      OUTPUT "Fizz"
    JIKA LAIN JIKA i MOD 5 = 0 MAKA
      OUTPUT "Buzz"
    JIKA LAIN
      OUTPUT i
    AKHIR JIKA
  AKHIR UNTUK
SELESAI` },
    { id: 'prima', title: 'Mencari bilangan prima', tp: 'BK.9.12', inputs: '', code:
`FUNGSI cari_bilangan_prima(batas)
  prima ← ARRAY kosong
  UNTUK n DARI 2 HINGGA batas
    adalah_prima ← BENAR
    UNTUK i DARI 2 HINGGA AKAR(n)
      JIKA n MOD i = 0 MAKA
        adalah_prima ← SALAH
      AKHIR JIKA
    AKHIR UNTUK
    JIKA adalah_prima MAKA
      TAMBAH n KE prima
    AKHIR JIKA
  AKHIR UNTUK
  KEMBALIKAN prima
AKHIR FUNGSI

MULAI
  OUTPUT cari_bilangan_prima(50)
SELESAI` },
    { id: 'bubble', title: 'Bubble Sort (ulang Modul 1)', tp: 'BK.9.9', inputs: '', code:
`# Bubble Sort: tukar dua elemen bertetangga yang urutannya salah
MULAI
  data ← [5, 3, 8, 1, 9, 2]
  n ← PANJANG(data)
  UNTUK i DARI 1 HINGGA n - 1
    UNTUK j DARI 1 HINGGA n - i
      JIKA data[j] > data[j + 1] MAKA
        sementara ← data[j]
        data[j] ← data[j + 1]
        data[j + 1] ← sementara
      AKHIR JIKA
    AKHIR UNTUK
  AKHIR UNTUK
  OUTPUT "Hasil urut: " + data
SELESAI` },
    { id: 'binary', title: 'Binary Search (soal uraian 5)', tp: 'BK.9.9', inputs: '23', code:
`# Binary search pada data yang sudah terurut
MULAI
  data ← [3, 8, 12, 17, 23, 31, 42, 56]
  INPUT dicari
  lo ← 1
  hi ← PANJANG(data)
  posisi ← -1
  SELAMA lo ≤ hi DAN posisi = -1
    mid ← (lo + hi) DIV 2
    JIKA data[mid] = dicari MAKA
      posisi ← mid
    JIKA LAIN JIKA data[mid] < dicari MAKA
      lo ← mid + 1
    JIKA LAIN
      hi ← mid - 1
    AKHIR JIKA
  AKHIR SELAMA
  JIKA posisi = -1 MAKA
    OUTPUT dicari + " tidak ditemukan"
  JIKA LAIN
    OUTPUT dicari + " ditemukan di posisi " + posisi
  AKHIR JIKA
SELESAI` },
  ];

  /* ───────── MISI (label LKPD mengikuti modul Informatika IX SMP Labschool Jakarta) ───────── */
  const MISSIONS = [
    { id: 'm1', lkpd: 'LKPD 1 · Bagian A', title: 'Menyeduh teh', skill: 'Sekuensial', tp: 'BK.9.7',
      task: 'Ubah algoritma sehari-hari menjadi pseudocode: panaskan air, masukkan teh celup, tuang air, tunggu 3 menit, angkat teh celup, tambah gula sesuai selera, lalu sajikan. Tanyakan takaran gula dengan INPUT.',
      hint: 'Tulis setiap langkah sebagai OUTPUT berurutan. Pastikan teksnya memuat kata: air, teh, 3 menit, gula, sajikan.',
      inputs: '2',
      starter: `# Misi: Menyeduh teh\nMULAI\n  OUTPUT "Panaskan air"\n  \nSELESAI`,
      reqs: [{ t: 'mulai' }, { t: 'input' }, { t: 'minStmts', n: 7 }],
      tests: [{ inputs: ['2'], all: ['air', 'teh', '3 menit', 'gula', 'saji'], note: 'urutan langkah benar' }] },
    { id: 'm2', lkpd: 'LKPD 1 · Bagian A', title: 'Genap atau ganjil', skill: 'Seleksi', tp: 'BK.9.8',
      task: 'Buat pseudocode yang menerima satu bilangan, lalu menampilkan "Genap" atau "Ganjil".',
      hint: 'Sisa bagi 2 dari bilangan genap selalu 0. Gunakan JIKA n MOD 2 = 0 MAKA.',
      inputs: '7',
      starter: `# Misi: Genap atau ganjil\nMULAI\n  INPUT n\n  \nSELESAI`,
      reqs: [{ t: 'mulai' }, { t: 'if' }],
      tests: [{ inputs: ['4'], all: ['genap'], none: ['ganjil'] }, { inputs: ['7'], all: ['ganjil'], none: ['genap'] }, { inputs: ['0'], all: ['genap'], none: ['ganjil'] }, { inputs: ['-3'], all: ['ganjil'], none: ['genap'] }] },
    { id: 'm3', lkpd: 'LKPD 1 · Bagian A', title: 'Total belanja 5 item', skill: 'Pengulangan', tp: 'BK.9.8',
      task: 'Hitung total belanja dari 5 item dengan harga berbeda. Harga diinput satu per satu, lalu tampilkan totalnya.',
      hint: 'Siapkan total ← 0 sebelum pengulangan, lalu UNTUK i DARI 1 HINGGA 5: INPUT harga, total ← total + harga.',
      inputs: '15000, 8000, 3500, 12000, 6500',
      starter: `# Misi: Total belanja\nMULAI\n  total ← 0\n  \nSELESAI`,
      reqs: [{ t: 'mulai' }, { t: 'loop' }],
      tests: [{ inputs: ['15000', '8000', '3500', '12000', '6500'], all: ['45000'] }, { inputs: ['1000', '2000', '3000', '4000', '5000'], all: ['15000'] }] },
    { id: 'm4', lkpd: 'LKPD 1 · Bagian B', title: 'Maksimum & minimum', skill: 'Pengulangan + seleksi', tp: 'BK.9.9',
      task: 'Cari nilai MAKSIMUM dan MINIMUM dari n bilangan. Input pertama adalah n, lalu n bilangan berikutnya. Tampilkan maksimum lebih dulu, baru minimum.',
      hint: 'Ambil bilangan pertama sebagai maks dan min. Lalu ulangi dengan SELAMA counter < n: INPUT x, bandingkan dengan maks dan min.',
      inputs: '5, 3, 9, 1, 7, 4',
      starter: `# Misi: Maksimum dan minimum\nMULAI\n  INPUT n\n  INPUT x\n  maks ← x\n  min ← x\n  counter ← 1\n  \nSELESAI`,
      reqs: [{ t: 'mulai' }, { t: 'loop' }, { t: 'if' }],
      tests: [{ inputs: ['5', '3', '9', '1', '7', '4'], all: ['9', '1'] }, { inputs: ['3', '-2', '-8', '-5'], all: ['-2', '-8'] }, { inputs: ['1', '42'], all: ['42', '42'] }] },
    { id: 'm5', lkpd: 'LKPD 1 · Bagian B', title: 'Palindrom', skill: 'Indeks teks', tp: 'BK.9.9',
      task: 'Cek apakah sebuah kata adalah PALINDROM, yaitu sama dibaca dari kiri maupun kanan (misalnya "katak"). Tampilkan "Palindrom" atau "Bukan palindrom".',
      hint: 'kata[1] adalah huruf pertama dan kata[PANJANG(kata)] huruf terakhir. Bandingkan huruf kiri dan kanan sambil bergerak ke tengah.',
      inputs: 'katak',
      starter: `# Misi: Palindrom\nMULAI\n  INPUT kata\n  kiri ← 1\n  kanan ← PANJANG(kata)\n  \nSELESAI`,
      reqs: [{ t: 'mulai' }, { t: 'loop' }],
      tests: [{ inputs: ['katak'], any: ['palindrom', 'benar', 'ya'], none: ['bukan', 'salah', 'tidak'] }, { inputs: ['kodok'], any: ['palindrom', 'benar', 'ya'], none: ['bukan', 'salah', 'tidak'] },
        { inputs: ['buku'], any: ['bukan', 'salah', 'tidak'] }, { inputs: ['malam'], any: ['palindrom', 'benar', 'ya'], none: ['bukan', 'salah', 'tidak'] }] },
    { id: 'm6', lkpd: 'LKPD 1 · Bagian B', title: 'Faktorial dengan UNTUK', skill: 'Pengulangan', tp: 'BK.9.9',
      task: 'Hitung FAKTORIAL n memakai pengulangan UNTUK (bukan rekursi). Contoh: 5! = 5 × 4 × 3 × 2 × 1 = 120.',
      hint: 'Mulai dari hasil ← 1, lalu UNTUK i DARI 1 HINGGA n: hasil ← hasil × i.',
      inputs: '5',
      starter: `# Misi: Faktorial\nMULAI\n  INPUT n\n  hasil ← 1\n  \nSELESAI`,
      reqs: [{ t: 'mulai' }, { t: 'for' }],
      tests: [{ inputs: ['5'], all: ['120'] }, { inputs: ['4'], all: ['24'] }, { inputs: ['1'], all: ['1'] }, { inputs: ['0'], all: ['1'] }] },
    { id: 'm7', lkpd: 'LKPD 1 · Bagian C', title: 'Tabel jejak faktorial', skill: 'Tracing', tp: 'BK.9.7', kind: 'trace',
      task: 'Lakukan tracing untuk pseudocode faktorial dengan input n = 4. Isi nilai hasil dan i setelah setiap iterasi, lalu tentukan OUTPUT-nya.',
      hint: 'Pada setiap putaran, hasil dikali i dulu, baru i bertambah 1.',
      code: 'faktorial',
      rows: [{ label: 'Iterasi 1', hasil: 1, i: 2 }, { label: 'Iterasi 2', hasil: 2, i: 3 }, { label: 'Iterasi 3', hasil: 6, i: 4 }, { label: 'Iterasi 4', hasil: 24, i: 5 }],
      output: 24 },
    { id: 'm8', lkpd: 'LKPD 2 · Bagian A', title: 'Fungsi predikat', skill: 'Fungsi', tp: 'BK.9.10',
      task: 'Lengkapi FUNGSI tentukan_predikat(nilai) yang mengembalikan "A" (≥ 90), "B" (≥ 80), "C" (≥ 70), "D" (≥ 60), atau "E". Fungsi ini akan diuji langsung dengan beberapa nilai, termasuk nilai batas.',
      hint: 'Gunakan JIKA … JIKA LAIN JIKA … dan cek dari batas tertinggi. Perhatikan nilai tepat 90 harus mendapat A.',
      inputs: '85',
      starter: `FUNGSI tentukan_predikat(nilai)\n  JIKA nilai >= 90 MAKA\n    KEMBALIKAN "A"\n  \n  AKHIR JIKA\nAKHIR FUNGSI\n\nMULAI\n  INPUT nilai\n  OUTPUT "Predikat: " + tentukan_predikat(nilai)\nSELESAI`,
      reqs: [{ t: 'named', name: 'tentukan_predikat', kind: 'FUNGSI' }, { t: 'elif' }],
      tests: [95, 90, 89, 80, 75, 70, 65, 60, 59, 40].map(v => ({ call: 'tentukan_predikat', args: [v], startsWith: v >= 90 ? 'A' : v >= 80 ? 'B' : v >= 70 ? 'C' : v >= 60 ? 'D' : 'E' })) },
    { id: 'm9', lkpd: 'LKPD 2 · Bagian A–C', title: 'Sistem konversi nilai', skill: 'Modularitas', tp: 'BK.9.10–12',
      task: 'Rancang sistem modular: baca nama dan nilai n siswa, hitung rata-rata, tertinggi, dan terendah, tentukan predikat tiap siswa, lalu cetak laporan. Gunakan 3 FUNGSI dan 1 PROSEDUR dengan nama sesuai kerangka.',
      hint: 'Urutan input: n, lalu nama dan nilai tiap siswa. Laporan mencetak per baris: nama, nilai, predikat. Setelah itu cetak rata-rata, nilai tertinggi, lalu terendah.',
      inputs: '3, Andi, 95, Budi, 72, Cici, 58',
      starter: `FUNGSI baca_nilai_siswa(n)\n  nama_list ← ARRAY kosong\n  nilai_list ← ARRAY kosong\n  UNTUK i DARI 1 HINGGA n\n    INPUT nama\n    INPUT nilai\n    TAMBAH nama KE nama_list\n    TAMBAH nilai KE nilai_list\n  AKHIR UNTUK\n  KEMBALIKAN nama_list, nilai_list\nAKHIR FUNGSI\n\nFUNGSI hitung_statistik(data)\n  # lengkapi: hitung rata-rata, maks, min\n  KEMBALIKAN 0, 0, 0\nAKHIR FUNGSI\n\nFUNGSI tentukan_predikat(nilai)\n  # lengkapi: A/B/C/D/E\n  KEMBALIKAN "E"\nAKHIR FUNGSI\n\nPROSEDUR cetak_laporan(nama_list, nilai_list, rata, maks, min_val)\n  # lengkapi: cetak nama, nilai, predikat tiap siswa, lalu statistik\nAKHIR PROSEDUR\n\nMULAI\n  INPUT n\n  nama_list, nilai_list ← baca_nilai_siswa(n)\n  rata, maks, min_val ← hitung_statistik(nilai_list)\n  cetak_laporan(nama_list, nilai_list, rata, maks, min_val)\nSELESAI`,
      reqs: [{ t: 'mulai' }, { t: 'funcs', n: 3 }, { t: 'procs', n: 1 }, { t: 'named', name: 'hitung_statistik', kind: 'FUNGSI' }, { t: 'named', name: 'tentukan_predikat', kind: 'FUNGSI' }, { t: 'named', name: 'cetak_laporan', kind: 'PROSEDUR' }],
      tests: [
        { inputs: ['3', 'Andi', '95', 'Budi', '72', 'Cici', '58'], all: ['Andi', '95', 'A', 'Budi', '72', 'C', 'Cici', '58', 'E', '75', '95', '58'], note: 'laporan 3 siswa + statistik' },
        { inputs: ['2', 'Dewi', '84', 'Eko', '66'], all: ['Dewi', '84', 'B', 'Eko', '66', 'D', '75', '84', '66'], note: 'laporan 2 siswa + statistik' },
        { call: 'hitung_statistik', args: [[80, 90, 70]], equals: [80, 90, 70], note: 'hitung_statistik([80, 90, 70]) → 80, 90, 70' },
      ] },
    { id: 'm10', lkpd: 'LKPD 2 · Bagian C', title: 'FizzBuzz', skill: 'Seleksi bertingkat', tp: 'BK.9.11',
      task: 'Cetak angka 1 sampai 100. Kelipatan 3 diganti "Fizz", kelipatan 5 diganti "Buzz", dan kelipatan keduanya diganti "FizzBuzz". Setelah lulus, lihat flowchart dan versi Python-nya.',
      hint: 'Cek i MOD 15 = 0 paling awal. Mengapa? Coba tukar urutannya dan lihat output angka 15.',
      inputs: '',
      starter: `MULAI\n  UNTUK i DARI 1 HINGGA 100\n    \n  AKHIR UNTUK\nSELESAI`,
      reqs: [{ t: 'mulai' }, { t: 'for' }, { t: 'elif' }],
      tests: [{ inputs: [], lines: ['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz'], count: 100, note: '15 baris pertama + total 100 baris' }] },
    { id: 'm11', lkpd: 'Pengayaan · BK.9.12', title: 'Bilangan prima', skill: 'Fungsi + pengulangan bersarang', tp: 'BK.9.12',
      task: 'Buat FUNGSI cari_bilangan_prima(batas) yang mengembalikan ARRAY berisi semua bilangan prima dari 2 sampai batas.',
      hint: 'Bilangan n prima jika tidak habis dibagi i untuk semua i dari 2 hingga AKAR(n).',
      inputs: '',
      starter: `FUNGSI cari_bilangan_prima(batas)\n  prima ← ARRAY kosong\n  \n  KEMBALIKAN prima\nAKHIR FUNGSI\n\nMULAI\n  OUTPUT cari_bilangan_prima(30)\nSELESAI`,
      reqs: [{ t: 'named', name: 'cari_bilangan_prima', kind: 'FUNGSI' }, { t: 'loop' }],
      tests: [{ call: 'cari_bilangan_prima', args: [20], equals: [2, 3, 5, 7, 11, 13, 17, 19] }, { call: 'cari_bilangan_prima', args: [2], equals: [2] }, { call: 'cari_bilangan_prima', args: [1], equals: [] }, { call: 'cari_bilangan_prima', args: [50], equals: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47] }] },
    { id: 'm12', lkpd: 'LKPD 3 · Kelompok', title: 'Proyek sistem kelompok', skill: 'Rancang sistem', tp: 'BK.9.7–12', kind: 'project',
      task: 'Pilih satu skenario, lalu rancang sistemnya bersama kelompok. Setiap anggota menulis minimal satu subprogram. Uji otomatis memeriksa jumlah subprogram, seleksi, pengulangan, dan MULAI/SELESAI. Jalankan sendiri untuk memastikan hasilnya benar.',
      hint: 'Uji setiap subprogram sendiri-sendiri dulu (panggil dari program utama dengan data contoh) sebelum digabungkan.',
      scenarios: [
        { id: 'A', title: 'ATM Sederhana', min: 5, desc: 'Cek saldo, tarik tunai, setor, transfer, ganti PIN (dengan validasi).', inputs: '1234, 1, 2, 50000, 1, 0',
          starter: `# Skenario A: ATM Sederhana\nFUNGSI validasi_pin(pin, pin_benar)\n  KEMBALIKAN pin = pin_benar\nAKHIR FUNGSI\n\nPROSEDUR cek_saldo(saldo)\n  OUTPUT "Saldo Anda: " + saldo\nAKHIR PROSEDUR\n\nFUNGSI tarik_tunai(saldo, jumlah)\n  # lengkapi: tolak jika saldo kurang\n  KEMBALIKAN saldo - jumlah\nAKHIR FUNGSI\n\n# tambahkan: setor, transfer, ganti_pin\n\nMULAI\n  saldo ← 500000\n  pin_benar ← 1234\n  INPUT pin\n  JIKA validasi_pin(pin, pin_benar) MAKA\n    INPUT menu\n    SELAMA menu ≠ 0\n      JIKA menu = 1 MAKA\n        cek_saldo(saldo)\n      JIKA LAIN JIKA menu = 2 MAKA\n        INPUT jumlah\n        saldo ← tarik_tunai(saldo, jumlah)\n      AKHIR JIKA\n      INPUT menu\n    AKHIR SELAMA\n  JIKA LAIN\n    OUTPUT "PIN salah"\n  AKHIR JIKA\nSELESAI` },
        { id: 'B', title: 'Toko Online Mini', min: 5, desc: 'Tampilkan produk, tambah ke keranjang, checkout, hitung total, konfirmasi.', inputs: '1, 2, 0',
          starter: `# Skenario B: Toko Online Mini\nPROSEDUR tampilkan_produk(nama, harga)\n  UNTUK i DARI 1 HINGGA PANJANG(nama)\n    OUTPUT i + ". " + nama[i] + " - Rp" + harga[i]\n  AKHIR UNTUK\nAKHIR PROSEDUR\n\nFUNGSI hitung_total(keranjang, harga)\n  total ← 0\n  UNTUK SETIAP k DALAM keranjang\n    total ← total + harga[k]\n  AKHIR UNTUK\n  KEMBALIKAN total\nAKHIR FUNGSI\n\n# tambahkan: tambah_ke_keranjang, checkout, konfirmasi\n\nMULAI\n  nama ← ["Buku tulis", "Pensil", "Penghapus"]\n  harga ← [5000, 3000, 2000]\n  keranjang ← ARRAY kosong\n  tampilkan_produk(nama, harga)\n  INPUT pilih\n  SELAMA pilih ≠ 0\n    TAMBAH pilih KE keranjang\n    INPUT pilih\n  AKHIR SELAMA\n  OUTPUT "Total: Rp" + hitung_total(keranjang, harga)\nSELESAI` },
        { id: 'C', title: 'Sistem Absensi', min: 4, desc: 'Input kehadiran, hitung persentase, beri status, cetak rekap, cari siswa.', inputs: 'H, H, S, H, A',
          starter: `# Skenario C: Sistem Absensi\nFUNGSI input_kehadiran(n)\n  data ← ARRAY kosong\n  UNTUK i DARI 1 HINGGA n\n    INPUT status\n    TAMBAH status KE data\n  AKHIR UNTUK\n  KEMBALIKAN data\nAKHIR FUNGSI\n\nFUNGSI hitung_persentase(data)\n  hadir ← 0\n  UNTUK SETIAP s DALAM data\n    JIKA s = "H" MAKA hadir ← hadir + 1 AKHIR JIKA\n  AKHIR UNTUK\n  KEMBALIKAN hadir ÷ PANJANG(data) × 100\nAKHIR FUNGSI\n\n# tambahkan: beri_status, cetak_rekap, cari_siswa\n\nMULAI\n  data ← input_kehadiran(5)\n  OUTPUT "Kehadiran: " + hitung_persentase(data) + "%"\nSELESAI` },
        { id: 'D', title: 'Kalkulator Ilmiah', min: 5, desc: '+, −, ×, ÷, pangkat, akar, log, mod, dan riwayat kalkulasi.', inputs: '12, 4, 1, 0',
          starter: `# Skenario D: Kalkulator Ilmiah\nFUNGSI tambah(a, b)\n  KEMBALIKAN a + b\nAKHIR FUNGSI\n\nFUNGSI bagi(a, b)\n  JIKA b = 0 MAKA\n    OUTPUT "Tidak bisa membagi dengan nol"\n    KEMBALIKAN 0\n  AKHIR JIKA\n  KEMBALIKAN a ÷ b\nAKHIR FUNGSI\n\n# tambahkan: kurang, kali, pangkat, akar, riwayat\n\nMULAI\n  riwayat ← ARRAY kosong\n  INPUT a\n  INPUT b\n  INPUT menu\n  SELAMA menu ≠ 0\n    JIKA menu = 1 MAKA\n      hasil ← tambah(a, b)\n    JIKA LAIN\n      hasil ← bagi(a, b)\n    AKHIR JIKA\n    OUTPUT "Hasil: " + hasil\n    TAMBAH hasil KE riwayat\n    INPUT menu\n  AKHIR SELAMA\n  OUTPUT "Riwayat: " + riwayat\nSELESAI` },
        { id: 'E', title: 'Game Tebak Angka', min: 4, desc: 'Buat angka acak, terima tebakan, beri petunjuk, hitung skor, simpan skor tertinggi.', inputs: '50, 25, 37, 31, 34',
          starter: `# Skenario E: Game Tebak Angka\nFUNGSI buat_angka()\n  KEMBALIKAN ACAK(1, 100)\nAKHIR FUNGSI\n\nPROSEDUR beri_petunjuk(tebakan, rahasia)\n  JIKA tebakan < rahasia MAKA\n    OUTPUT "Terlalu kecil"\n  JIKA LAIN\n    OUTPUT "Terlalu besar"\n  AKHIR JIKA\nAKHIR PROSEDUR\n\n# tambahkan: hitung_skor, simpan_skor_tertinggi\n\nMULAI\n  rahasia ← buat_angka()\n  percobaan ← 0\n  INPUT tebakan\n  percobaan ← percobaan + 1\n  SELAMA tebakan ≠ rahasia DAN percobaan < 7\n    beri_petunjuk(tebakan, rahasia)\n    INPUT tebakan\n    percobaan ← percobaan + 1\n  AKHIR SELAMA\n  JIKA tebakan = rahasia MAKA\n    OUTPUT "Benar! Dalam " + percobaan + " percobaan"\n  JIKA LAIN\n    OUTPUT "Kesempatan habis. Angkanya " + rahasia\n  AKHIR JIKA\nSELESAI` },
      ] },
  ];


  /* Soal mode Susun Flowchart: pengecoh = kartu yang tampak benar tetapi salah, beserta alasannya */
  const PUZZLES = [
    { id: 'f1', title: 'Luas persegi panjang', skill: 'Sekuensial', ref: 'BK.9.11',
      story: 'Program meminta panjang dan lebar sebuah persegi panjang, menghitung luasnya, lalu menampilkan hasilnya.',
      inputs: '8, 5',
      decoys: [['luas ← panjang + lebar', 'Luas dihitung dengan mengalikan panjang dan lebar, bukan menjumlahkannya.']],
      code:
`MULAI
  INPUT panjang
  INPUT lebar
  luas ← panjang × lebar
  OUTPUT "Luas = " + luas
SELESAI` },
    { id: 'f2', title: 'Genap atau ganjil', skill: 'Seleksi', ref: 'LKPD 1 · A',
      story: 'Program meminta sebuah bilangan bulat. Jika sisa baginya dengan 2 adalah 0, tampilkan "Genap"; jika tidak, tampilkan "Ganjil".',
      inputs: '7',
      decoys: [['angka DIV 2 = 0?', 'DIV menghasilkan hasil bagi, bukan sisa bagi. Untuk memeriksa genap, pakai MOD.']],
      code:
`MULAI
  INPUT angka
  JIKA angka MOD 2 = 0 MAKA
    OUTPUT "Genap"
  JIKA LAIN
    OUTPUT "Ganjil"
  AKHIR JIKA
SELESAI` },
    { id: 'f3', title: 'Login sederhana', skill: 'Seleksi + logika DAN', ref: 'BK.9.7',
      story: 'Pengguna mengetik username dan password. Login berhasil hanya jika username "admin" dan password "1234" keduanya benar.',
      inputs: 'admin, 1234',
      decoys: [['username = "admin" ATAU password = "1234"?', 'Dengan ATAU, login tetap berhasil walaupun password-nya salah.']],
      code:
`MULAI
  INPUT username
  INPUT password
  JIKA username = "admin" DAN password = "1234" MAKA
    OUTPUT "Login berhasil"
  JIKA LAIN
    OUTPUT "Login gagal"
  AKHIR JIKA
SELESAI` },
    { id: 'f4', title: 'Total belanja 5 item', skill: 'Pengulangan UNTUK', ref: 'LKPD 1 · A',
      story: 'Kasir memasukkan harga 5 barang satu per satu. Program menjumlahkan semuanya, lalu menampilkan total belanja.',
      inputs: '12000, 5000, 7500, 3000, 2500',
      decoys: [['i < 5?', 'Dengan i < 5, pengulangan berhenti sebelum barang ke-5 dihitung.'], ['total ← harga', 'total ← harga menimpa total dengan harga terakhir. Total harus ditambah: total ← total + harga.']],
      code:
`MULAI
  total ← 0
  UNTUK i DARI 1 HINGGA 5
    INPUT harga
    total ← total + harga
  AKHIR UNTUK
  OUTPUT "Total belanja: " + total
SELESAI` },
    { id: 'f5', title: 'Validasi nilai 0–100', skill: 'Pengulangan SELAMA', ref: 'BK.9.9',
      story: 'Program meminta nilai ujian. Selama nilai di bawah 0 atau di atas 100, program menampilkan peringatan dan meminta nilai lagi.',
      inputs: '150, -5, 87',
      decoys: [['nilai < 0 DAN nilai > 100?', 'Tidak ada bilangan yang sekaligus di bawah 0 dan di atas 100, jadi kondisi ini selalu SALAH.']],
      code:
`MULAI
  INPUT nilai
  SELAMA nilai < 0 ATAU nilai > 100
    OUTPUT "Tidak valid, ulangi"
    INPUT nilai
  AKHIR SELAMA
  OUTPUT "Nilai diterima: " + nilai
SELESAI` },
    { id: 'f6', title: 'Faktorial n', skill: 'Pengulangan SELAMA', ref: 'LKPD 1 · C',
      story: 'Program meminta n, lalu menghitung n! = 1 × 2 × … × n dengan pengulangan SELAMA dan menampilkan hasilnya.',
      inputs: '4',
      decoys: [['i < n?', 'Dengan i < n, perkalian dengan n sendiri terlewat. 4! akan menjadi 6, bukan 24.'], ['hasil ← hasil + i', 'Faktorial adalah perkalian berturut-turut, bukan penjumlahan.']],
      code:
`MULAI
  INPUT n
  hasil ← 1
  i ← 1
  SELAMA i ≤ n
    hasil ← hasil × i
    i ← i + 1
  AKHIR SELAMA
  OUTPUT hasil
SELESAI` },
    { id: 'f7', title: 'FizzBuzz 1–15', skill: 'Seleksi bertingkat', ref: 'LKPD 2 · C',
      story: 'Untuk i dari 1 sampai 15: kelipatan 15 ditulis "FizzBuzz", kelipatan 3 ditulis "Fizz", kelipatan 5 ditulis "Buzz", selain itu tulis angkanya. Urutan pemeriksaan menentukan hasil.',
      inputs: '',
      decoys: [['i MOD 2 = 0?', 'FizzBuzz tidak memeriksa kelipatan 2.']],
      code:
`MULAI
  UNTUK i DARI 1 HINGGA 15
    JIKA i MOD 15 = 0 MAKA
      OUTPUT "FizzBuzz"
    JIKA LAIN JIKA i MOD 3 = 0 MAKA
      OUTPUT "Fizz"
    JIKA LAIN JIKA i MOD 5 = 0 MAKA
      OUTPUT "Buzz"
    JIKA LAIN
      OUTPUT i
    AKHIR JIKA
  AKHIR UNTUK
SELESAI` },
    { id: 'f8', title: 'Predikat dengan fungsi', skill: 'Subprogram', ref: 'LKPD 2 · A',
      story: 'Program utama meminta nilai lalu memanggil fungsi predikat. Fungsi mengembalikan "A" untuk nilai ≥ 90, "B" untuk nilai ≥ 75, dan "C" untuk nilai lainnya. Ada dua flowchart: program utama dan fungsinya.',
      inputs: '82',
      decoys: [['nilai ≤ 90?', 'Predikat A untuk nilai 90 ke atas, jadi kondisinya nilai ≥ 90.']],
      code:
`FUNGSI predikat(nilai)
  JIKA nilai ≥ 90 MAKA
    KEMBALIKAN "A"
  JIKA LAIN JIKA nilai ≥ 75 MAKA
    KEMBALIKAN "B"
  JIKA LAIN
    KEMBALIKAN "C"
  AKHIR JIKA
AKHIR FUNGSI

MULAI
  INPUT nilai
  hasil ← predikat(nilai)
  OUTPUT "Predikat: " + hasil
SELESAI` },
  ];

  const API = { EXAMPLES, MISSIONS, PUZZLES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.LabData = API;
})(typeof window !== 'undefined' ? window : globalThis);
