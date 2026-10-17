# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

Never include your SWDE customer number, your API bearer token or the URL of a
private data endpoint in a report: describe them instead.

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

How this integration handles your data:

- it never asks for, stores or sends an SWDE customer-portal password;
- the optional API bearer token is a Gladys `secret` field, sent only to the
  endpoint you configured, in the `Authorization` header, and never logged;
- an endpoint URL carrying credentials (`https://user:pass@…`) or a scheme
  other than HTTP(S) is refused;
- the container runs as the unprivileged `node` user on a read-only root
  filesystem.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the third-party services the integration talks to (the SWDE customer
portal, easyCONSO, or the JSON endpoint you configure).
