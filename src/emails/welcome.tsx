import { Html, Head, Body, Container, Heading, Text, Link, Hr } from '@react-email/components'
import { render } from '@react-email/render'

interface Props { name: string; siteUrl: string; verifyUrl?: string }

function WelcomeEmail({ name, siteUrl, verifyUrl }: Props) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', padding: '24px', color: '#111' }}>
        <Heading as="h2" style={{ color: '#e57c2c' }}>Welcome to Robot Food, {name}!</Heading>
        <Text>Your AI-powered kitchen assistant is ready. Start typing your ingredients and get instant recipe ideas.</Text>
        {verifyUrl && (
          <>
            <Text style={{ color: '#555' }}>First, please verify your email address:</Text>
            <Link href={verifyUrl} style={{ display: 'inline-block', background: '#e57c2c', color: '#fff', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', fontWeight: 600, marginTop: '8px' }}>
              Verify Email
            </Link>
          </>
        )}
        {!verifyUrl && (
          <Link href={`${siteUrl}/kitchen`} style={{ display: 'inline-block', background: '#e57c2c', color: '#fff', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none', fontWeight: 600, marginTop: '16px' }}>
            Start Cooking
          </Link>
        )}
        <Hr style={{ marginTop: '32px' }} />
        <Text style={{ color: '#999', fontSize: '13px' }}>
          <Link href={siteUrl} style={{ color: '#999' }}>ingredientbot.com</Link>
        </Text>
      </Body>
    </Html>
  )
}

export async function renderWelcomeEmail(props: Props): Promise<string> {
  return render(<WelcomeEmail {...props} />)
}
