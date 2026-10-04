using System.Collections.Generic;
using UnityEngine;

namespace Unity.MP_FPS
{
    [CreateAssetMenu(fileName = "WeaponRegistry", menuName = "FPS Sample/Weapon Registry")]
    public class WeaponRegistry : ScriptableObject
    {
        public List<WeaponData> Weapons;

        public WeaponData GetWeaponData(uint weaponID)
        {
            if (Weapons == null || weaponID >= (uint)Weapons.Count)
            {
                return null;
            }

            return Weapons[(int)weaponID];
        }
    }
}