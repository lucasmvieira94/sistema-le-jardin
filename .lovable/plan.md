# Assinatura no mesmo rodapé de autenticidade

## Situação atual
- No PDF final assinado, cada signatário ganha um bloco próprio, com QR Code repetido, colocado depois do conteúdo. Esse bloco pode ir para uma página nova, separado do selo de autenticidade.
- O texto mostra só nome, papel e horário. Não mostra CPF nem local.
- O CPF dos signatários externos já fica guardado. A geolocalização também é registrada, mas nem sempre vem preenchida.

## O que vai mudar
Um rodapé único na última página, no estilo SEI:

```text
+--------------------------------------------------------------+
| [SXCare] Documento AUTÊNTICO assinado eletronicamente por:   |
|   • Maria Silva, Responsável financeiro, CPF ***.456.789-**, |
|     em 23/11/2026 às 14:17 (horário de Brasília), Porto Alegre/RS |
|   • João Souza, Diretor, CPF ***.111.222-**, em ... , local   |
+--------------------------------------------------------------+
| [QR] Autenticidade: link, código verificador e CRC/SHA-256   |
+--------------------------------------------------------------+
```

- Todos os signatários aparecem na mesma faixa superior. A faixa inferior tem um único QR Code.
- O rodapé fica sempre na mesma página que o selo de autenticidade. Se o conteúdo ocupar o espaço reservado, o rodapé completo passa junto para a página seguinte, sem ser dividido.
- O local da assinatura vem da cidade/estado aprovados na assinatura (geolocalização). Sem esse dado, usa a "Cidade / UF" de Configurações, com a indicação "local da instituição".
- O CPF aparece mascarado, por proteção de dados (LGPD). A versão completa continua só na verificação online.
- Documentos sem assinatura mantêm o texto atual: "não representa assinatura".

## Onde vale
1. Documentos com envio externo, como contratos, distratos e contratos temporários: a versão final que o gestor baixa e o anexo do e-mail.
2. Documentos internos dos colaboradores, assinados na Central de Documentos: advertências, folhas de ponto, contracheques e comunicados. Cargo e CPF vêm da ficha do funcionário.
3. A versão em tela (HTML) recebe o mesmo layout.

## Detalhes técnicos
- `src/utils/rodapeDocumento.ts`: `RegistroAssinaturaDocumento` passa a ter `cpf` e `local`, e `renderRodapeDocumentoPDF` e `rodapeDocumentoHTML` passam a aceitar uma lista de assinaturas. A altura do rodapé é calculada para todos os signatários; com até 4, cabe nos 72 mm reservados, e acima disso a reserva cresce. Inclui uma função pura `mascararCpf` e uma de texto da assinatura.
- `supabase/functions/_shared/assinaturaFinalPDF.ts`: troca o laço com um bloco por signatário por um rodapé único na última página, ancorado no fim dela. Antes, confere se o conteúdo cabe; se não couber, abre uma página nova. O local vem de `geolocalizacao` (cidade/UF) ou da configuração da empresa.
- Central de Documentos (`useDocumentosFuncionario`, `certificarArquivoPDF`): passar cargo, CPF e local ao carimbar a via assinada.
- PDFs finais que já foram salvos não são gerados de novo, para manter os mesmos bytes já auditados. A regra vale para as novas assinaturas.
- Testes: mascaramento do CPF, texto com nome, cargo, CPF, horário de Brasília e local, vários signatários num único rodapé e reposicionamento quando falta espaço. Rodar as regressões de `certificarPDF` e registrar em `docs/historico-correcoes.md`.
