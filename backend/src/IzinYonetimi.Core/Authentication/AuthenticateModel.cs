using System.ComponentModel.DataAnnotations;

namespace IzinYonetimi.Authentication
{
    public class AuthenticateModel
    {
        [Required]
        public string UserNameOrEmailAddress { get; set; }

        [Required]
        public string Password { get; set; }

        public bool RememberClient { get; set; }
    }

    public class AuthenticateResultModel
    {
        public string AccessToken { get; set; }
        public int ExpireInSeconds { get; set; }
        public long UserId { get; set; }
    }
}
