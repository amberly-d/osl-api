# Privacy model

This is the single reference for what Open Support Ledger stores, what it shows
publicly, and what every API endpoint must do with supporter data.

It is a product and engineering document, not legal advice and not a claim of
compliance with any law or regulation. If legal requirements conflict with this
document, stop and ask the maintainers.

## 1. Data classes

Every field belongs to exactly one of these classes.

### Blockchain-public

Visible on the Stellar network to anyone, forever, whether or not this product
shows it. We cannot hide or delete it.

Examples: Stellar account addresses, payment amounts, asset codes and issuers,
transaction hashes, ledger numbers, and transaction memos. Stellar's Horizon
API describes these fields in its [transaction
resource](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/transactions/object)
and [payment
resource](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/payments/object).
Memos are part of the transaction and are covered by the [memo
guide](https://developers.stellar.org/docs/build/guides/transactions/pooled-accounts-muxed-accounts-memos).

### Application-public

Shown by this product only after the supporter explicitly opts in, or because
the project owner published it as part of a project profile. Public API
responses may contain these fields, but only in the shapes defined for that
endpoint.

Examples: a supporter's chosen display name, a public message, a project's
name, description and logo.

### Private application data

Never returned by a public endpoint. Only the API process, authorised operators
and internal tooling may see it, and only when needed.

Examples: an anonymous supporter's name and message, opt-in flags before they
are resolved into a public response, client IP addresses, raw request bodies,
moderation notes and internal failure details.

## 2. What "anonymous" means here

Anonymous means **we do not display the supporter's name or message**. It does
not mean the payment is untraceable.

The sender's Stellar address, amount, asset, memo and transaction hash remain
public on the Stellar network. Anyone who knows the transaction hash can look
up the transaction through a block explorer or Horizon's [retrieve a
transaction](https://developers.stellar.org/docs/data/apis/horizon/api-reference/retrieve-a-transaction)
endpoint and see the sender address. Address clustering and off-chain context
can link addresses to people; we must not imply otherwise.

Therefore:

- Do not label a payment "untraceable" or promise sender anonymity.
- Do not put a private name, email address or message in a Stellar memo. Memos
  are blockchain-public and cannot be removed.
- If a supporter chooses anonymous, omit both the name and message from API
  responses. Do not return them as `null` with the expectation that the UI will
  hide them.
- Treat the public display of a wallet address as a separate product decision.
  Even when the UI shortens an address, the full address is still public.

## 3. Field-by-field plan

"Who can see it" describes the public API and on-chain reality, not what an
operator can access in the database.

### Project

| Field | Class | Who can see it | Notes |
|---|---|---|---|
| `id` | Application-public | Anyone | Internal UUID; safe to expose. |
| `slug` | Application-public | Anyone | Stable public URL key. |
| `name` | Application-public | Anyone | Published project profile. |
| `description` | Application-public | Anyone | Published project profile. |
| `logoUrl` | Application-public | Anyone | Must be `https://`. Do not proxy arbitrary URLs into logs. |
| `paymentAddress` | Blockchain-public | Anyone | A Stellar public key; it is visible on-chain and in the profile. |
| `ownerAccount` (planned) | Blockchain-public for the address; private for the ownership link | Address: anyone. Link: internal until verified | Ownership verification is not implemented yet. |
| `createdAt`, `updatedAt` | Application-public | Anyone | No private data. |

### Payment intent

A payment intent is created before a transaction is submitted. It is not a
payment and must not be counted in project totals until a matching payment is
confirmed.

| Field | Class | Who can see it | Notes |
|---|---|---|---|
| `id` | Private application data | API and authorised operators | A capability token may be returned to the creator, but do not expose it as a public page id. |
| `projectId` | Application-public | Anyone | The project is already public. |
| `amount` | Private application data | Creator, API, authorised operators | Could reveal a planned donation before it happens. It becomes blockchain-public after payment. |
| `asset` | Private application data | Creator, API, authorised operators | Same reasoning as amount. |
| `memo` | Private application data until submitted; then blockchain-public | Creator first; anyone after submission | Memos are public on-chain. Never put private text in one. |
| `status` | Private application data | Creator, API, authorised operators | `pending`, `expired`, `submitted`, `failed`. |
| `createdAt`, `expiresAt` | Private application data | Creator, API, authorised operators | Timing can be sensitive before payment. |

### Payment

| Field | Class | Who can see it | Notes |
|---|---|---|---|
| `id` | Application-public | Anyone | Public payment route id. |
| `txHash` | Blockchain-public | Anyone | Links directly to the on-chain transaction. |
| `projectId` | Application-public | Anyone | The project is public. |
| `senderAddress` | Blockchain-public | Anyone | Full address is on-chain. Shortening in the UI does not hide it. |
| `amount`, `asset` (code and issuer) | Blockchain-public | Anyone | Match the on-chain asset exactly, including issuer. See [assets](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets). |
| `memo` | Blockchain-public | Anyone | Public and immutable. |
| `ledger`, `closedAt` | Blockchain-public | Anyone | Finality metadata from the network. |
| `status` | Application-public | Anyone | `pending`, `confirmed`, `failed`, `invalid`, `duplicate`, `unsupported_asset`. |
| `displayName` | Application-public only after explicit name opt-in | Anyone when opted in; otherwise omitted | Default is private. Omitting is safer than returning an empty string. |
| `message` | Application-public only after explicit message opt-in | Anyone when opted in; otherwise omitted | Default is private. Public messages still need moderation. |
| `showName`, `showMessage` | Private application data | API and authorised operators | Resolve these flags into the public response; do not return the raw flags. |
| `anonymous` flag | Private application data | API and authorised operators | The public response should omit the supporter block rather than expose a boolean. |
| `createdAt`, `confirmedAt` | Application-public | Anyone | Use network time for confirmation. |
| `rawNetworkPayload` | Private application data | API and authorised operators | Large internal payload; never return it. |
| `moderationNotes` | Private application data | Authorised operators only | Never public. |

### Requests and operations

| Field | Class | Who can see it | Notes |
|---|---|---|---|
| Client IP address | Private application data | Authorised operators, security tooling | Not for analytics or public display. |
| User agent, request id | Private application data | Authorised operators | Keep only for debugging and abuse prevention. |
| Raw request/response bodies | Private application data | Authorised operators | Never log bodies; they can contain names and messages. |
| Application logs | Private application data | Authorised operators | Allowlist fields; see the rules below. |

## 4. Rules for contributors

1. **Redact in the API, not only in the UI.** A field that must not be public
   must not be serialised by a public endpoint. Hiding it with CSS or a client
   conditional is not a privacy control.
2. **Return explicit response types, never entities.** Do not spread a TypeORM
   entity into a response. Map to a DTO whose public fields are intentional and
   whose private fields do not exist. Add tests that assert private fields are
   absent.
3. **Names and messages are opt-in.** Both default to private, and each needs its
   own explicit choice. If the supporter is anonymous, omit the entire supporter
   block from the response. Never infer consent from a filled-in field.
4. **Never log names, messages or full request bodies.** Log an allowlist:
   method, route, status, duration, request id and a hashed or truncated client
   identifier if needed for abuse prevention. Redact query strings and headers
   that can contain tokens.
5. **Collect the minimum.** Do not add email, phone, address or social handles
   unless the feature cannot work without them. Store only what the documented
   feature needs.
6. **Mark mock data clearly.** Sample projects, supporters, messages and
   payments must be obviously fake in code, UI and generated output. Never use
   a real person's name or a real wallet without explicit permission.
7. **Memos are public.** Do not use a Stellar memo as a private message channel.
   Keep private messages off-chain and encrypt or delete them according to the
   retention policy.
8. **A wallet address is not an identity.** Do not build profiles, cross-project
   tracking or "known supporter" features from addresses without a separate,
   explicit product decision and consent.
9. **Authorisation is not privacy.** Internal or admin endpoints still need
   authentication and authorisation. "Not linked in the UI" is not access
   control.
10. **Deletion must be scoped honestly.** We can delete rows we control, but we
    cannot delete on-chain data. Do not promise deletion of blockchain-public
    fields.

## 5. Open questions for maintainers

1. How long should private application data (names, messages, IP addresses,
   moderation notes) be retained after a project or payment is deleted?
2. Should supporters be able to edit or delete a public name or message after
   opting in? What happens to cached or indexed copies?
3. How should we record consent: separate booleans, a versioned consent record,
   or a timestamped snapshot of the chosen fields?
4. Should the public UI show full sender addresses, shortened addresses, or no
   address by default? Any choice must still state that the address is public
   on-chain.
5. Do we need a moderation queue before a public message is visible, or only a
   report-and-remove flow?
6. What is the policy for exporting or aggregating anonymous payments across
   projects? Even aggregate data can re-identify small groups.
7. Which jurisdiction's retention and deletion requirements apply, and who is
   responsible for responding to requests?
8. Should project owners be able to see private supporter data? The default
   answer in this document is no; changing it needs a separate decision.

## References

All Stellar-specific claims above link to official Stellar documentation:

- [Transactions](https://developers.stellar.org/docs/learn/fundamentals/transactions)
- [Transaction resource fields](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/transactions/object)
- [Retrieve a transaction](https://developers.stellar.org/docs/data/apis/horizon/api-reference/retrieve-a-transaction)
- [Payments resource](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/payments/object)
- [Memos, muxed accounts and pooled accounts](https://developers.stellar.org/docs/build/guides/transactions/pooled-accounts-muxed-accounts-memos)
- [Accounts](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts)
- [Assets and issuers](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets)
- [List of operations](https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations)
