import React from "react";
import { Link } from "react-router-dom";
import { Card, CardBody } from "../../../components/ui/Card";

const noticeVersion = "2026-11-v1";

export const PrivacyNoticePage: React.FC = () => (
  <main className="container" style={{ maxWidth: 920, paddingTop: "var(--space-10)", paddingBottom: "var(--space-12)" }}>
    <div style={{ marginBottom: "var(--space-6)" }}>
      <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)", marginBottom: 6 }}>CHURCHCONNECT · PRIVACY / PRIVASI</p>
      <h1 style={{ fontSize: "var(--text-3xl)", margin: "0 0 var(--space-2)" }}>Privacy Notice / Notis Privasi</h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>Version {noticeVersion} · Draft for organisational and legal review / Draf untuk semakan organisasi dan undang-undang</p>
    </div>

    <Card><CardBody style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div style={{ padding: "var(--space-4)", border: "1px solid var(--color-warning-border, #d6a84b)", borderRadius: "var(--radius-md)", background: "var(--color-warning-bg, #fffaf0)" }}>
        <strong>Publication hold / Belum untuk penerbitan</strong>
        <p style={{ marginBottom: 0, fontSize: "var(--text-sm)" }}>
          Before this notice is published as final, the church must replace every bracketed placeholder, confirm the legal entity acting as data controller, confirm the privacy contact, document hosting locations and cross-border transfers, and obtain Malaysian legal/privacy review.
        </p>
        <p style={{ marginBottom: 0, fontSize: "var(--text-sm)" }}>
          Sebelum notis ini diterbitkan sebagai versi muktamad, pihak gereja mesti menggantikan semua ruang bertanda kurungan, mengesahkan entiti undang-undang yang bertindak sebagai pengawal data, mengesahkan pegawai perhubungan privasi, mendokumenkan lokasi pengehosan dan pemindahan rentas sempadan, serta mendapatkan semakan undang-undang/privasi Malaysia.
        </p>
      </div>

      <section>
        <h2>1. Who is responsible? / Siapakah yang bertanggungjawab?</h2>
        <p><strong>English:</strong> ChurchConnect is operated for <strong>[INSERT CHURCH'S FULL LEGAL NAME / REGISTERED ENTITY]</strong> (the organisation responsible for deciding why and how personal data is processed). Its address is <strong>[INSERT REGISTERED / BUSINESS ADDRESS]</strong>. Contact the privacy representative at <strong>[INSERT PRIVACY CONTACT EMAIL]</strong> or <strong>[INSERT TELEPHONE, IF APPLICABLE]</strong>.</p>
        <p><strong>Bahasa Malaysia:</strong> ChurchConnect dikendalikan bagi pihak <strong>[MASUKKAN NAMA PENUH ENTITI / ORGANISASI GEREJA]</strong> (organisasi yang menentukan tujuan dan cara data peribadi diproses). Alamatnya ialah <strong>[MASUKKAN ALAMAT BERDAFTAR / PERNIAGAAN]</strong>. Hubungi wakil privasi melalui <strong>[MASUKKAN E-MEL PERHUBUNGAN PRIVASI]</strong> atau <strong>[MASUKKAN TELEFON, JIKA BERKENAAN]</strong>.</p>
      </section>

      <section>
        <h2>2. Information we collect / Maklumat yang kami kumpulkan</h2>
        <p><strong>English:</strong> Depending on the features you use, ChurchConnect may collect your name, primary and secondary email addresses, date of birth, account credentials and authentication records, account approval and role information, congregation or ministry participation, event and service activity, communications you submit, and privacy-consent records. Do not submit information that is not requested or necessary.</p>
        <p><strong>Bahasa Malaysia:</strong> Bergantung pada ciri yang digunakan, ChurchConnect boleh mengumpulkan nama, alamat e-mel utama dan sekunder, tarikh lahir, maklumat kelayakan dan rekod pengesahan akaun, status kelulusan dan peranan akaun, penyertaan dalam jemaah atau pelayanan, aktiviti acara dan perkhidmatan, komunikasi yang dihantar, serta rekod persetujuan privasi. Jangan berikan maklumat yang tidak diminta atau tidak diperlukan.</p>
      </section>

      <section>
        <h2>3. Sources and technical information / Sumber dan maklumat teknikal</h2>
        <p><strong>English:</strong> Information is collected directly from you through registration and account forms, from your use of ChurchConnect, and from authorised church administrators who maintain membership or ministry records. The service may also process basic technical information such as access logs, device/browser details, security events and cookies or similar technologies needed for authentication, security and service operation. The organisation must document any analytics or non-essential tracking before enabling it.</p>
        <p><strong>Bahasa Malaysia:</strong> Maklumat dikumpulkan secara langsung daripada anda melalui pendaftaran dan borang akaun, daripada penggunaan ChurchConnect, serta daripada pentadbir gereja yang diberi kuasa untuk menyelenggara rekod keahlian atau pelayanan. Perkhidmatan ini juga mungkin memproses maklumat teknikal asas seperti log akses, butiran peranti/pelayar, peristiwa keselamatan dan kuki atau teknologi serupa yang diperlukan untuk pengesahan, keselamatan dan operasi perkhidmatan. Organisasi hendaklah mendokumenkan sebarang analitik atau penjejakan bukan penting sebelum mengaktifkannya.</p>
      </section>

      <section>
        <h2>4. Sensitive personal data / Data peribadi sensitif</h2>
        <p><strong>English:</strong> A person's church, congregation or ministry affiliation may reveal religious belief. Malaysian PDPA guidance identifies religious beliefs as sensitive personal data. Access to this information must be restricted to authorised people with a legitimate church-administration need. Where the PDPA applies, express consent or another legally permitted condition must be established before processing sensitive personal data.</p>
        <p><strong>Bahasa Malaysia:</strong> Afiliasi seseorang dengan gereja, jemaah atau pelayanan boleh mendedahkan kepercayaan agama. Panduan PDPA Malaysia mengelaskan kepercayaan agama sebagai data peribadi sensitif. Akses kepada maklumat ini hendaklah dihadkan kepada individu yang diberi kuasa dan mempunyai keperluan pentadbiran gereja yang sah. Jika PDPA terpakai, persetujuan nyata atau asas lain yang dibenarkan undang-undang hendaklah diwujudkan sebelum data peribadi sensitif diproses.</p>
      </section>

      <section>
        <h2>4. Why we use information / Tujuan penggunaan maklumat</h2>
        <p><strong>English:</strong> We use information to create and secure accounts; verify identity and email; review registrations and eligibility; administer church, congregation, ministry, volunteer, event and service activities; communicate operational information; maintain records and audit trails; provide support; prevent misuse; and meet applicable legal obligations. We will not treat this notice as permission to use information for unrelated purposes.</p>
        <p><strong>Bahasa Malaysia:</strong> Kami menggunakan maklumat untuk mewujudkan dan melindungi akaun; mengesahkan identiti dan e-mel; menyemak pendaftaran dan kelayakan; mengurus aktiviti gereja, jemaah, pelayanan, sukarelawan, acara dan perkhidmatan; menyampaikan maklumat operasi; menyelenggara rekod dan jejak audit; memberi sokongan; mencegah penyalahgunaan; serta memenuhi kewajipan undang-undang yang terpakai. Notis ini bukan kebenaran untuk menggunakan maklumat bagi tujuan lain yang tidak berkaitan.</p>
      </section>

      <section>
        <h2>5. Children and people under 18 / Kanak-kanak dan individu di bawah 18 tahun</h2>
        <p><strong>English:</strong> Date of birth is used to identify registrations from people under 18. Such registrations are flagged for administrator review and do not receive member access automatically. The church must complete its safeguarding and parent/guardian-consent checks where required before clearing the review or approving access. The review flag is not itself proof of parent/guardian consent.</p>
        <p><strong>Bahasa Malaysia:</strong> Tarikh lahir digunakan untuk mengenal pasti pendaftaran individu di bawah umur 18 tahun. Pendaftaran tersebut akan ditandakan untuk semakan pentadbir dan tidak diberikan akses ahli secara automatik. Pihak gereja hendaklah melengkapkan semakan perlindungan serta semakan persetujuan ibu bapa/penjaga jika diperlukan sebelum meluluskan semakan atau akses. Status semakan bukan bukti persetujuan ibu bapa/penjaga.</p>
      </section>

      <section>
        <h2>6. Disclosure and service providers / Pendedahan dan penyedia perkhidmatan</h2>
        <p><strong>English:</strong> Information may be available to authorised church administrators and ministry personnel according to their assigned permissions. Technical service providers supporting authentication, database hosting, application hosting, email delivery, security and backups may process information on the organisation's behalf. The current platform uses Supabase and Vercel; the organisation must confirm the exact services, contractual terms, data locations and any subprocessors before launch. We do not sell personal data.</p>
        <p><strong>Bahasa Malaysia:</strong> Maklumat boleh diakses oleh pentadbir gereja dan petugas pelayanan yang diberi kuasa mengikut kebenaran yang ditetapkan. Penyedia perkhidmatan teknikal bagi pengesahan identiti, pengehosan pangkalan data, pengehosan aplikasi, penghantaran e-mel, keselamatan dan sandaran mungkin memproses maklumat bagi pihak organisasi. Platform semasa menggunakan Supabase dan Vercel; organisasi hendaklah mengesahkan perkhidmatan, terma kontrak, lokasi data dan subpemproses sebelum pelancaran. Kami tidak menjual data peribadi.</p>
      </section>

      <section>
        <h2>7. Transfers and storage / Pemindahan dan penyimpanan</h2>
        <p><strong>English:</strong> Service providers may store or process information in Malaysia or other countries, depending on the configured service and region. Before launch, the organisation must identify actual storage and processing locations and document the safeguards and legal basis for any transfer outside Malaysia. Information is retained only for as long as needed for the stated purposes, legal requirements, safeguarding, dispute resolution and legitimate recordkeeping, under an approved retention schedule.</p>
        <p><strong>Bahasa Malaysia:</strong> Penyedia perkhidmatan mungkin menyimpan atau memproses maklumat di Malaysia atau negara lain, bergantung pada perkhidmatan dan rantau yang dikonfigurasikan. Sebelum pelancaran, organisasi hendaklah mengenal pasti lokasi penyimpanan dan pemprosesan sebenar serta mendokumenkan perlindungan dan asas undang-undang bagi sebarang pemindahan ke luar Malaysia. Maklumat disimpan hanya selama yang diperlukan bagi tujuan yang dinyatakan, keperluan undang-undang, perlindungan, penyelesaian pertikaian dan penyimpanan rekod yang sah, mengikut jadual penyimpanan yang diluluskan.</p>
      </section>

      <section>
        <h2>8. Security / Keselamatan</h2>
        <p><strong>English:</strong> We apply access controls, role-based permissions, authentication safeguards, database policies, audit records and appropriate technical and organisational measures. No online service can guarantee absolute security. Suspected personal-data incidents are handled under the organisation's incident-response and applicable notification procedures.</p>
        <p><strong>Bahasa Malaysia:</strong> Kami melaksanakan kawalan akses, kebenaran berasaskan peranan, perlindungan pengesahan identiti, polisi pangkalan data, rekod audit serta langkah teknikal dan organisasi yang bersesuaian. Tiada perkhidmatan dalam talian yang boleh menjamin keselamatan mutlak. Insiden data peribadi yang disyaki akan dikendalikan mengikut prosedur tindak balas insiden organisasi dan tatacara pemberitahuan yang terpakai.</p>
      </section>

      <section>
        <h2>9. Your rights and choices / Hak dan pilihan anda</h2>
        <p><strong>English:</strong> Subject to applicable law, you may request access to or correction of your personal data, withdraw consent where processing is based on consent, ask questions about processing, and raise a complaint. You may also opt out of optional promotional communications. Requests should be sent to the privacy contact above. We may need to verify your identity before acting. Withdrawal does not make prior lawful processing unlawful and may affect services that require the relevant information.</p>
        <p><strong>Bahasa Malaysia:</strong> Tertakluk kepada undang-undang yang terpakai, anda boleh memohon akses atau pembetulan data peribadi, menarik balik persetujuan apabila pemprosesan berasaskan persetujuan, bertanya tentang pemprosesan dan mengemukakan aduan. Anda juga boleh memilih untuk tidak menerima komunikasi promosi pilihan. Permohonan hendaklah dihantar kepada pegawai perhubungan privasi di atas. Identiti anda mungkin perlu disahkan sebelum tindakan diambil. Penarikan balik persetujuan tidak menjadikan pemprosesan terdahulu yang sah sebagai tidak sah dan mungkin menjejaskan perkhidmatan yang memerlukan maklumat berkenaan.</p>
      </section>

      <section>
        <h2>10. Optional communications / Komunikasi pilihan</h2>
        <p><strong>English:</strong> Promotional messages, fundraising appeals or other optional communications require a separate choice where consent is the applicable basis. Declining optional communications does not prevent you from creating an account or receiving essential service and account notices.</p>
        <p><strong>Bahasa Malaysia:</strong> Mesej promosi, rayuan pengumpulan dana atau komunikasi pilihan lain memerlukan pilihan persetujuan yang berasingan apabila persetujuan merupakan asas yang terpakai. Penolakan komunikasi pilihan tidak menghalang anda daripada membuka akaun atau menerima notis penting berkaitan perkhidmatan dan akaun.</p>
      </section>

      <section>
        <h2>11. Changes and complaints / Perubahan dan aduan</h2>
        <p><strong>English:</strong> We may update this notice when our practices or legal obligations change. Material changes will be communicated and a new consent will be requested where required. For privacy questions or complaints, contact [INSERT PRIVACY CONTACT EMAIL]. You may also contact the Personal Data Protection Commissioner through the official Department of Personal Data Protection website.</p>
        <p><strong>Bahasa Malaysia:</strong> Kami boleh mengemas kini notis ini apabila amalan atau kewajipan undang-undang berubah. Perubahan penting akan dimaklumkan dan persetujuan baharu akan diminta jika diperlukan. Untuk pertanyaan atau aduan privasi, hubungi [MASUKKAN E-MEL PERHUBUNGAN PRIVASI]. Anda juga boleh menghubungi Pesuruhjaya Perlindungan Data Peribadi melalui laman rasmi Jabatan Perlindungan Data Peribadi.</p>
      </section>

      <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "var(--space-4)" }}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>By continuing with registration, you will be asked to acknowledge this notice and provide the required consent for the stated purposes. Optional marketing consent is separate.</p>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>Dengan meneruskan pendaftaran, anda akan diminta mengakui notis ini dan memberikan persetujuan yang diperlukan bagi tujuan yang dinyatakan. Persetujuan pemasaran pilihan adalah berasingan.</p>
        <Link to="/signup" style={{ color: "var(--color-forest-green)", fontWeight: 700 }}>Return to registration / Kembali ke pendaftaran</Link>
      </div>
    </CardBody></Card>
  </main>
);
