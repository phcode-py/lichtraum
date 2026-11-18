/** Account actions live in their own paper, away from the photo collection. */
export default function AccountPanel({signedOut=false}:{signedOut?:boolean}){
 return <section className="account-panel" aria-label="Account"><h1>Account</h1><nav aria-label="Account actions">{signedOut?<a href="/signin">Sign in</a>:<><a href="/password">Change password</a><a href="/auth/signout">Sign out</a></>}</nav></section>;
}
