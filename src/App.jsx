import { useState } from 'react';
import './App.css';

// [PT-BR] Exemplo de front-end React para assinatura CMS/CAdES com certificado
// PKCS#12 (arquivo .pfx/.p12 já importado na SolidSign API — este app não faz
// a importação, só a assinatura). Reaproveita a lógica de campos/parâmetros
// da tela "Assinar CMS" do Portal SolidSign (src/pages/Signer/SignerCMS.jsx),
// cortando tudo que não é específico deste método: sem login/AuthContext, sem
// i18n, sem co-assinatura (o backend de exemplo não suporta originalFile).
//
// [EN] React front-end example for CMS/CAdES signing with a PKCS#12
// certificate (a .pfx/.p12 already imported in the SolidSign API — this app
// only signs, it does not import). Reuses the field/parameter logic from the
// Portal SolidSign "Sign CMS" screen (src/pages/Signer/SignerCMS.jsx),
// trimmed of everything not specific to this method: no login/AuthContext,
// no i18n, no co-signing (the example backend doesn't support originalFile).
//
// Este front-end fala com o backend de exemplo local (porta padrão 8080),
// nunca diretamente com a SolidSign API.
// This front-end talks to the local example backend (default port 8080),
// never directly to the SolidSign API.

const BACKEND_URL = 'http://localhost:8080/api/cms/sign/form';

const PROFILES = ['ADRB', 'ADRT', 'ADRC', 'ADRA', 'CADES_B', 'CADES_T', 'CADES_LT', 'CADES_LTA'];

export default function App() {
  const [baseUrl, setBaseUrl] = useState('https://www.solidsign.com.br');
  const [authorization, setAuthorization] = useState('');
  const [pfxCode, setPfxCode] = useState('');
  const [documents, setDocuments] = useState([]);

  const [profile, setProfile] = useState('ADRB');
  const [hashAlgorithm, setHashAlgorithm] = useState('SHA256');
  const [signaturePackaging, setSignaturePackaging] = useState('ATTACHED');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (documents.length === 0) { setError('Selecione ao menos um documento.'); return; }
    if (!pfxCode.trim()) { setError('Informe o pfxCode do certificado já importado.'); return; }
    if (!authorization.trim()) { setError('Informe o token de autorização (Bearer).'); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      documents.forEach((f) => fd.append('document', f));
      fd.append('authorization', authorization.startsWith('Bearer ') ? authorization : `Bearer ${authorization}`);
      fd.append('baseUrl', baseUrl);
      fd.append('pfxCode', pfxCode);
      fd.append('profile', profile);
      fd.append('hashAlgorithm', hashAlgorithm);
      fd.append('signaturePackaging', signaturePackaging);

      // O backend de exemplo assina, baixa os .p7s resultantes da SolidSign API
      // e devolve um único ZIP binário pronto (não um JSON com links).
      const res = await fetch(BACKEND_URL, { method: 'POST', body: fd });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = text;
        try { msg = JSON.parse(text)?.message || text; } catch { /* keep raw text */ }
        setError(msg || `Erro HTTP ${res.status}`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResult({ url, count: documents.length });
    } catch (err) {
      setError(`Falha ao chamar o backend de exemplo em ${BACKEND_URL} — ele está rodando? (${err.message})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1>Assinar CMS/CAdES — PKCS#12 (exemplo React)</h1>
      <p className="subtitle">
        Front-end de exemplo para o back-end <code>exemplo-integracao-cms-pkcs12</code>.
        Certificado deve já estar importado na SolidSign API (endpoint
        <code>POST /solidsign/dsig/certificates/pkcs12/import</code>) — este exemplo
        só demonstra a etapa de assinatura. Gera <code>.p7s</code>, serve pra qualquer
        tipo de arquivo (não só PDF).
      </p>

      <form onSubmit={submit} className="form">
        <fieldset>
          <legend>1. Conexão com a SolidSign API</legend>
          <label>Base URL da API
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://www.solidsign.com.br" />
          </label>
          <label>Token de autorização (Bearer)
            <input value={authorization} onChange={(e) => setAuthorization(e.target.value)} placeholder="eyJhbGciOi..." />
          </label>
        </fieldset>

        <fieldset>
          <legend>2. Documento e certificado</legend>
          <label>Documento(s) — qualquer tipo de arquivo
            <input type="file" multiple onChange={(e) => setDocuments(Array.from(e.target.files))} />
          </label>
          <label>pfxCode (id do certificado já importado)
            <input value={pfxCode} onChange={(e) => setPfxCode(e.target.value)} placeholder="a1b2c3d4-e5f6-7890-abcd-ef1234567890" />
          </label>
        </fieldset>

        <fieldset>
          <legend>3. Parâmetros de assinatura</legend>
          <label>Perfil
            <select value={profile} onChange={(e) => setProfile(e.target.value)}>
              {PROFILES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>Algoritmo de hash
            <select value={hashAlgorithm} onChange={(e) => setHashAlgorithm(e.target.value)}>
              <option value="SHA256">SHA-256</option>
              <option value="SHA512">SHA-512</option>
            </select>
          </label>
          <label>Empacotamento
            <select value={signaturePackaging} onChange={(e) => setSignaturePackaging(e.target.value)}>
              <option value="ATTACHED">ATTACHED (documento embutido no .p7s)</option>
              <option value="DETACHED">DETACHED (assinatura separada)</option>
            </select>
          </label>
        </fieldset>

        <button type="submit" disabled={loading}>{loading ? 'Assinando…' : 'ASSINAR DOCUMENTOS'}</button>
      </form>

      {error && <div className="box error">{error}</div>}

      {result && (
        <div className="box success">
          <h3>Sucesso!</h3>
          <p>{result.count} documento(s) assinado(s).</p>
          <a href={result.url} download="signed_cms.zip" className="download-btn">Baixar ZIP com o(s) .p7s assinado(s)</a>
        </div>
      )}
    </div>
  );
}
