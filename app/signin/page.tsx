import type {Metadata} from 'next';
import SignInForm from './signin-form';

export const metadata: Metadata = {title: 'Sign in — lichtraum zürich'};

export default async function SignIn({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {error}=await searchParams;
 return <SignInForm linkError={!!error}/>;
}
